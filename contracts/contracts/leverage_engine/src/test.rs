#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
    token::Client as TokenClient,
    token::StellarAssetClient,
};

// Import other contract stubs for testing client calls
use lending_pool::{LendingPoolContract, LendingPoolContractClient};
use mock_amm::{MockAmmContract, MockAmmContractClient};

#[test]
fn test_integration_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let liquidator = Address::generate(&env);
    let lender = Address::generate(&env);

    // 1. Deploy Mock USDC (Token A) and Mock XLM (Token B)
    let token_a_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_b_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    let token_a_client = TokenClient::new(&env, &token_a_id);
    let token_b_client = TokenClient::new(&env, &token_b_id);

    let token_a_admin = StellarAssetClient::new(&env, &token_a_id);
    let token_b_admin = StellarAssetClient::new(&env, &token_b_id);

    // 2. Deploy Lending Pool Contract
    let pool_id = env.register(LendingPoolContract, (admin.clone(), token_a_id.clone()));
    let pool_client = LendingPoolContractClient::new(&env, &pool_id);

    // 3. Deploy Mock AMM Contract
    let amm_id = env.register(MockAmmContract, (token_a_id.clone(), token_b_id.clone()));
    let amm_client = MockAmmContractClient::new(&env, &amm_id);

    // 4. Deploy Leverage Engine Contract
    let engine_id = env.register(
        LeverageEngineContract,
        (
            admin.clone(),
            token_a_id.clone(),
            token_b_id.clone(),
            pool_id.clone(),
            amm_id.clone(),
        ),
    );
    let engine_client = LeverageEngineContractClient::new(&env, &engine_id);

    // 5. Authorize Leverage Engine in the Lending Pool
    pool_client.set_leverage_engine(&engine_id);

    // 6. Pre-seed users with balances
    // Lender deposits 5000 USDC into Lending Pool
    token_a_admin.mint(&lender, &5000);
    token_a_admin.mint(&amm_id, &5000); // AMM pool liquidity seeds
    token_b_admin.mint(&amm_id, &5000);

    pool_client.deposit(&lender, &5000);
    assert_eq!(pool_client.get_total_liquidity(), 5000);
    assert_eq!(pool_client.get_borrow_rate(), 200_000); // 2% dynamic interest rate initially

    // User gets 200 USDC collateral
    token_a_admin.mint(&user, &200);

    // 7. Open leveraged position: User deposits 100 USDC with 3x leverage (300 USDC position size)
    // Collateral = 100 USDC, Borrow = 200 USDC
    let collateral = 100i128;
    let leverage = 300u32; // 3x leverage

    let lp_shares = engine_client.open_position(&user, &collateral, &leverage);
    assert_eq!(lp_shares, 300); // LP Shares = USDC deposit (150) + XLM deposit (150)

    // Verify balances after leveraged open
    assert_eq!(token_a_client.balance(&user), 100); // User used 100 USDC
    assert_eq!(pool_client.get_total_borrowed(), 200); // 200 USDC borrowed from pool
    assert_eq!(pool_client.get_total_liquidity(), 4800); // Liquidity dropped from 5000 to 4800
    
    // Dynamic rate utilization checks: rate should have scaled up
    // U = 200 / 5000 = 4%
    // Rate = 2% + 4% * 8% = 2.32% = 232,000
    assert_eq!(pool_client.get_borrow_rate(), 232_000);

    // Check position mapping details
    let position = engine_client.get_position(&user).unwrap();
    assert_eq!(position.collateral, 100);
    assert_eq!(position.borrow_amount, 200);
    assert_eq!(position.lp_shares, 300);

    let health = engine_client.get_health_factor(&user);
    // Health factor: (lp_shares * 80) / borrow_amount = (300 * 80) / 200 = 120 (Healthy >= 100)
    assert_eq!(health, 120);

    // 8. Close Position: close and settle user position
    let payout = engine_client.close_position(&user);
    // Unwound LP shares (300) -> withdrawn 150 USDC + 150 XLM
    // Swapped 150 XLM back -> +150 USDC. Total USDC = 300 USDC.
    // Repay debt: principal (200) + 5% interest (10) = 210 USDC.
    // Payout to user = 300 - 210 = 90 USDC.
    assert_eq!(payout, 90);
    assert_eq!(token_a_client.balance(&user), 190); // Initial 100 + 90 payout = 190 USDC.
    assert!(engine_client.get_position(&user).is_none());
}

#[test]
fn test_liquidation_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let liquidator = Address::generate(&env);
    let lender = Address::generate(&env);

    let token_a_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_b_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    let token_a_client = TokenClient::new(&env, &token_a_id);
    let token_b_client = TokenClient::new(&env, &token_b_id);

    let token_a_admin = StellarAssetClient::new(&env, &token_a_id);
    let token_b_admin = StellarAssetClient::new(&env, &token_b_id);

    let pool_id = env.register(LendingPoolContract, (admin.clone(), token_a_id.clone()));
    let pool_client = LendingPoolContractClient::new(&env, &pool_id);

    let amm_id = env.register(MockAmmContract, (token_a_id.clone(), token_b_id.clone()));
    let amm_client = MockAmmContractClient::new(&env, &amm_id);

    let engine_id = env.register(
        LeverageEngineContract,
        (
            admin.clone(),
            token_a_id.clone(),
            token_b_id.clone(),
            pool_id.clone(),
            amm_id.clone(),
        ),
    );
    let engine_client = LeverageEngineContractClient::new(&env, &engine_id);

    pool_client.set_leverage_engine(&engine_id);

    // Seed balances
    token_a_admin.mint(&lender, &5000);
    token_a_admin.mint(&amm_id, &5000);
    token_b_admin.mint(&amm_id, &5000);
    pool_client.deposit(&lender, &5000);

    token_a_admin.mint(&user, &100);

    // Open position: 100 USDC collateral, 4x leverage (400 USDC position size)
    // Collateral = 100 USDC, Borrow = 300 USDC, LP shares = 400
    engine_client.open_position(&user, &100, &400);

    // Check health: (400 * 80) / 300 = 106. Healthy (since 106 >= 100).
    assert_eq!(engine_client.get_health_factor(&user), 106);

    // Test: Try liquidating healthy position should fail
    let liq_err = engine_client.try_liquidate(&user, &liquidator);
    assert!(liq_err.is_err());

    // Open a high leverage position (5.5x) which is liquidatable instantly:
    // Collateral = 100 USDC, leverage = 550.
    // Borrow = 450 USDC, lp_shares = 550.
    // Health factor = (550 * 80) / 450 = 97 (liquidatable).
    let user2 = Address::generate(&env);
    token_a_admin.mint(&user2, &100);
    engine_client.open_position(&user2, &100, &550);

    assert_eq!(engine_client.get_health_factor(&user2), 97);

    // Liquidate user2
    engine_client.liquidate(&user2, &liquidator);

    // Verify user2 position is deleted
    assert!(engine_client.get_position(&user2).is_none());

    // Payout verification:
    // Unwound LP shares (550) -> withdrawn 275 USDC + 275 XLM
    // Swapped 275 XLM back -> +275 USDC. Total USDC = 550.
    // Repay debt: principal (450) + 5% interest (22) = 472 USDC.
    // Remaining margin = 550 - 472 = 78 USDC.
    // Liquidator reward = 78 / 10 = 7 USDC.
    // User refund = 78 - 7 = 71 USDC.
    assert_eq!(token_a_client.balance(&liquidator), 7);
    assert_eq!(token_a_client.balance(&user2), 71);
}
