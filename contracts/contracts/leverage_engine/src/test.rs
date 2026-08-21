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
    let _liquidator = Address::generate(&env);
    let lender = Address::generate(&env);

    // 1. Deploy Mock USDC (Token A) and Mock XLM (Token B)
    let token_a_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_b_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    let token_a_client = TokenClient::new(&env, &token_a_id);
    let _token_b_client = TokenClient::new(&env, &token_b_id);

    let token_a_admin = StellarAssetClient::new(&env, &token_a_id);
    let token_b_admin = StellarAssetClient::new(&env, &token_b_id);

    // 2. Deploy Lending Pool Contract
    let pool_id = env.register(LendingPoolContract, (admin.clone(), token_a_id.clone()));
    let pool_client = LendingPoolContractClient::new(&env, &pool_id);

    // 3. Deploy Mock AMM Contract
    let amm_id = env.register(MockAmmContract, (token_a_id.clone(), token_b_id.clone()));
    let _amm_client = MockAmmContractClient::new(&env, &amm_id);

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
    // Lender deposits 5000_000_000 USDC into Lending Pool
    token_a_admin.mint(&lender, &5_000_000_000);
    token_a_admin.mint(&amm_id, &5_000_000_000); // AMM pool liquidity seeds
    token_b_admin.mint(&amm_id, &5_000_000_000);

    pool_client.deposit(&lender, &5_000_000_000);
    assert_eq!(pool_client.get_total_liquidity(), 5_000_000_000);
    assert_eq!(pool_client.get_borrow_rate(), 200_000); // 2% dynamic interest rate initially

    // User gets 200_000_000 USDC collateral
    token_a_admin.mint(&user, &200_000_000);

    // 7. Open leveraged position: User deposits 100_000_000 USDC with 3x leverage (300 USDC position size)
    // Collateral = 100_000_000 USDC, Borrow = 200_000_000 USDC
    let collateral = 100_000_000i128;
    let leverage = 300u32; // 3x leverage

    let lp_shares = engine_client.open_position(&user, &collateral, &leverage);
    assert_eq!(lp_shares, 300_000_000); // LP Shares = USDC deposit (150) + XLM deposit (150)

    // Verify balances after leveraged open
    assert_eq!(token_a_client.balance(&user), 100_000_000); // User used 100 USDC
    assert_eq!(pool_client.get_total_borrowed(), 200_000_000); // 200 USDC borrowed from pool
    assert_eq!(pool_client.get_total_liquidity(), 4_800_000_000); // Liquidity dropped from 5000 to 4800
    
    // Dynamic rate utilization checks: rate should have scaled up
    // U = 200 / 5000 = 4%
    // Rate = 2% + 4% * 8% = 2.32% = 232,000
    assert_eq!(pool_client.get_borrow_rate(), 232_000);

    // Check position mapping details
    let position = engine_client.get_position(&user).unwrap();
    assert_eq!(position.collateral, 100_000_000);
    assert_eq!(position.borrow_amount, 200_000_000);
    assert_eq!(position.lp_shares, 300_000_000);

    let health = engine_client.get_health_factor(&user);
    // Health factor: (lp_shares * 80) / borrow_amount = (300 * 80) / 200 = 120 (Healthy >= 100)
    assert_eq!(health, 120);

    // 8. Close Position: close and settle user position
    let payout = engine_client.close_position(&user);
    // Unwound LP shares (300M) -> withdrawn 150M USDC + 150M XLM
    // Swapped 150M XLM back -> +150M USDC. Total USDC = 300M USDC.
    // Repay debt: principal (200M) + 5% interest (10M) = 210M USDC.
    // Payout to user = 300M - 210M = 90M USDC.
    assert_eq!(payout, 90_000_000);
    assert_eq!(token_a_client.balance(&user), 190_000_000); // Initial 100 + 90 payout = 190 USDC.
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
    let _token_b_client = TokenClient::new(&env, &token_b_id);

    let token_a_admin = StellarAssetClient::new(&env, &token_a_id);
    let token_b_admin = StellarAssetClient::new(&env, &token_b_id);

    let pool_id = env.register(LendingPoolContract, (admin.clone(), token_a_id.clone()));
    let pool_client = LendingPoolContractClient::new(&env, &pool_id);

    let amm_id = env.register(MockAmmContract, (token_a_id.clone(), token_b_id.clone()));
    let _amm_client = MockAmmContractClient::new(&env, &amm_id);

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
    token_a_admin.mint(&lender, &5_000_000_000);
    token_a_admin.mint(&amm_id, &5_000_000_000);
    token_b_admin.mint(&amm_id, &5_000_000_000);
    pool_client.deposit(&lender, &5_000_000_000);

    token_a_admin.mint(&user, &100_000_000);

    // Open position: 100 USDC collateral, 4x leverage (400 USDC position size)
    // Collateral = 100M USDC, Borrow = 300M USDC, LP shares = 400M
    engine_client.open_position(&user, &100_000_000, &400);

    // Check health: (400 * 80) / 300 = 106. Healthy (since 106 >= 100).
    assert_eq!(engine_client.get_health_factor(&user), 106);

    // Test: Try liquidating healthy position should fail
    let liq_err = engine_client.try_liquidate(&user, &liquidator);
    assert!(liq_err.is_err());

    // Open a high leverage position (5.5x) which is liquidatable instantly:
    // Collateral = 100M USDC, leverage = 550.
    // Borrow = 450M USDC, lp_shares = 550M.
    // Health factor = (550 * 80) / 450 = 97 (liquidatable).
    let user2 = Address::generate(&env);
    token_a_admin.mint(&user2, &100_000_000);
    engine_client.open_position(&user2, &100_000_000, &550);

    assert_eq!(engine_client.get_health_factor(&user2), 97);

    // Liquidate user2
    engine_client.liquidate(&user2, &liquidator);

    // Verify user2 position is deleted
    assert!(engine_client.get_position(&user2).is_none());

    // Payout verification:
    // Remaining margin = 77.5M USDC.
    // Liquidator reward = 77.5M / 10 = 7_750_000 USDC.
    // User refund = 77.5M - 7.75M = 69_750_000 USDC.
    assert_eq!(token_a_client.balance(&liquidator), 7_750_000);
    assert_eq!(token_a_client.balance(&user2), 69_750_000);
}

#[test]
fn test_health_factor_boundary() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let lender = Address::generate(&env);

    let token_a_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_b_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    let token_a_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_a_id);
    let token_b_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_b_id);

    let pool_id = env.register(lending_pool::LendingPoolContract, (admin.clone(), token_a_id.clone()));
    let pool_client = lending_pool::LendingPoolContractClient::new(&env, &pool_id);
    let amm_id = env.register(mock_amm::MockAmmContract, (token_a_id.clone(), token_b_id.clone()));
    let engine_id = env.register(
        LeverageEngineContract,
        (admin.clone(), token_a_id.clone(), token_b_id.clone(), pool_id.clone(), amm_id.clone()),
    );
    let engine_client = LeverageEngineContractClient::new(&env, &engine_id);
    pool_client.set_leverage_engine(&engine_id);

    token_a_admin.mint(&lender, &5_000_000_000);
    token_a_admin.mint(&amm_id, &5_000_000_000);
    token_b_admin.mint(&amm_id, &5_000_000_000);
    pool_client.deposit(&lender, &5_000_000_000);

    // No position: health factor defaults to max (1000)
    assert_eq!(engine_client.get_health_factor(&user), 1000);

    // Open position with 3x leverage
    token_a_admin.mint(&user, &200_000_000);
    engine_client.open_position(&user, &100_000_000, &300u32);
    // Health: (300 * 80) / 200 = 120
    assert_eq!(engine_client.get_health_factor(&user), 120);

    // Verify get_min_collateral returns the expected protocol constant
    assert_eq!(engine_client.get_min_collateral(), 10_000_000);
}

#[test]
fn test_liquidation_underwater_position() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let liquidator = Address::generate(&env);
    let lender = Address::generate(&env);

    let token_a_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_b_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

    let token_a_client = TokenClient::new(&env, &token_a_id);
    let token_a_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_a_id);
    let token_b_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_b_id);

    let pool_id = env.register(lending_pool::LendingPoolContract, (admin.clone(), token_a_id.clone()));
    let pool_client = lending_pool::LendingPoolContractClient::new(&env, &pool_id);

    let amm_id = env.register(mock_amm::MockAmmContract, (token_a_id.clone(), token_b_id.clone()));
    let engine_id = env.register(
        LeverageEngineContract,
        (admin.clone(), token_a_id.clone(), token_b_id.clone(), pool_id.clone(), amm_id.clone()),
    );
    let engine_client = LeverageEngineContractClient::new(&env, &engine_id);
    pool_client.set_leverage_engine(&engine_id);

    token_a_admin.mint(&lender, &5_000_000_000);
    token_a_admin.mint(&amm_id, &5_000_000_000);
    token_b_admin.mint(&amm_id, &5_000_000_000);
    pool_client.deposit(&lender, &5_000_000_000);

    token_a_admin.mint(&user, &100_000_000);
    
    // Open position with high leverage (6x)
    engine_client.open_position(&user, &100_000_000, &600u32); // Borrow 500M
    
    // Artificially hike AMM slippage/fee to 25% to force severe bad debt on unwind
    let amm_client = mock_amm::MockAmmContractClient::new(&env, &amm_id);
    amm_client.set_fee(&25);

    // Position is heavily underwater because swap back will lose 25%
    let health = engine_client.get_health_factor(&user);
    assert!(health < 100);

    // Liquidate the underwater position - it should not panic
    engine_client.liquidate(&user, &liquidator);

    // Position should be removed
    assert!(engine_client.get_position(&user).is_none());

    // User gets nothing (0 refund) since all margin was consumed by bad debt
    assert_eq!(token_a_client.balance(&user), 0);
}
