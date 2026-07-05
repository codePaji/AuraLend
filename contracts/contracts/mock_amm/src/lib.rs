#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env,
    token::Client as TokenClient,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    TokenA,
    TokenB,
    TotalShares,
    LpBalance(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidToken = 1,
    InsufficientBalance = 2,
    InvalidAmount = 3,
}

#[contract]
pub struct MockAmmContract;

#[contractimpl]
impl MockAmmContract {
    pub fn __constructor(env: Env, token_a: Address, token_b: Address) {
        env.storage().instance().set(&DataKey::TokenA, &token_a);
        env.storage().instance().set(&DataKey::TokenB, &token_b);
        env.storage().instance().set(&DataKey::TotalShares, &0i128);
    }

    // Swaps token_in for token_out (1:1 mock exchange)
    // Expects token_in to have already been transferred to this contract address
    pub fn swap(
        env: Env,
        user: Address,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
    ) -> Result<i128, Error> {
        if amount_in <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();

        if (token_in != token_a && token_in != token_b) || (token_out != token_a && token_out != token_b) {
            return Err(Error::InvalidToken);
        }

        let client_out = TokenClient::new(&env, &token_out);
        let amount_out = amount_in;

        // Transfer output token: AMM -> user (or leverage engine)
        client_out.transfer(&env.current_contract_address(), &user, &amount_out);

        Ok(amount_out)
    }

    // Deposits Token A and Token B to mint LP shares (shares = A + B)
    // Expects Token A and Token B to have already been transferred to this contract address
    pub fn deposit(
        env: Env,
        user: Address,
        amount_a: i128,
        amount_b: i128,
    ) -> Result<i128, Error> {
        if amount_a <= 0 || amount_b <= 0 {
            return Err(Error::InvalidAmount);
        }

        let shares = amount_a + amount_b;

        let key = DataKey::LpBalance(user.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current_balance + shares));

        let total_key = DataKey::TotalShares;
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        env.storage().instance().set(&total_key, &(current_total + shares));

        Ok(shares)
    }

    // Burns LP shares to withdraw Token A and Token B (1 share = 0.5 A + 0.5 B)
    pub fn withdraw(env: Env, user: Address, shares: i128) -> Result<(i128, i128), Error> {
        if shares <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::LpBalance(user.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if current_balance < shares {
            return Err(Error::InsufficientBalance);
        }

        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();

        let client_a = TokenClient::new(&env, &token_a);
        let client_b = TokenClient::new(&env, &token_b);

        let amount_a = shares / 2;
        let amount_b = shares / 2;

        // Return tokens back to the user
        client_a.transfer(&env.current_contract_address(), &user, &amount_a);
        client_b.transfer(&env.current_contract_address(), &user, &amount_b);

        // Update balances
        env.storage().persistent().set(&key, &(current_balance - shares));

        let total_key = DataKey::TotalShares;
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        env.storage().instance().set(&total_key, &(current_total - shares));

        Ok((amount_a, amount_b))
    }

    // Query helper for LP balance
    pub fn get_lp_balance(env: Env, user: Address) -> i128 {
        let key = DataKey::LpBalance(user);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    // Query helper for total shares
    pub fn get_total_shares(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
    }
}
