#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
    token::Client as TokenClient,
    token::StellarAssetClient,
};

#[test]
fn test_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Register a mock token
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = TokenClient::new(&env, &token_id);
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    // Register the lending pool contract with constructor args
    let contract_id = env.register(LendingPoolContract, (admin.clone(), token_id.clone()));
    let client = LendingPoolContractClient::new(&env, &contract_id);

    // Mint testing tokens to the user using the administrative client
    let mint_amount = 1000i128;
    token_admin_client.mint(&user, &mint_amount);
    assert_eq!(token_client.balance(&user), 1000);

    // Execute first deposit
    let deposit_amount = 400i128;
    let new_balance = client.deposit(&user, &deposit_amount);
    assert_eq!(new_balance, 400);

    // Verify token transfers and pool balances
    assert_eq!(token_client.balance(&user), 600);
    assert_eq!(token_client.balance(&contract_id), 400);
    assert_eq!(client.get_balance(&user), 400);
    assert_eq!(client.get_total_liquidity(), 400);

    // Execute withdrawal
    let withdraw_amount = 150i128;
    let final_balance = client.withdraw(&user, &withdraw_amount);
    assert_eq!(final_balance, 250);

    // Verify final state
    assert_eq!(token_client.balance(&user), 750);
    assert_eq!(token_client.balance(&contract_id), 250);
    assert_eq!(client.get_balance(&user), 250);
    assert_eq!(client.get_total_liquidity(), 250);
}

#[test]
fn test_errors() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let contract_id = env.register(LendingPoolContract, (admin.clone(), token_id.clone()));
    let client = LendingPoolContractClient::new(&env, &contract_id);

    // Test: Withdraw without balance should throw InsufficientBalance
    let withdraw_res = client.try_withdraw(&user, &100i128);
    assert!(withdraw_res.is_err());

    // Test: Invalid deposit amount should throw InvalidAmount
    let deposit_res = client.try_deposit(&user, &0i128);
    assert!(deposit_res.is_err());

    let negative_deposit_res = client.try_deposit(&user, &-50i128);
    assert!(negative_deposit_res.is_err());
}

#[test]
fn test_utilization_rate() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let engine = Address::generate(&env); // Simulated leverage engine

    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register(LendingPoolContract, (admin.clone(), token_id.clone()));
    let client = LendingPoolContractClient::new(&env, &contract_id);

    // Empty pool: utilization should be 0
    assert_eq!(client.get_utilization_rate(), 0);

    // Deposit 1000 from user
    token_admin.mint(&user, &1000);
    client.deposit(&user, &1000);
    assert_eq!(client.get_utilization_rate(), 0); // nothing borrowed yet

    // Register engine and borrow 400
    client.set_leverage_engine(&engine);
    token_admin.mint(&contract_id, &1000); // seed contract so it can transfer
    client.borrow(&user, &400);

    // Utilization = 400 / (600 + 400) = 40% = 4_000_000 (7 decimals)
    assert_eq!(client.get_utilization_rate(), 4_000_000);
}
