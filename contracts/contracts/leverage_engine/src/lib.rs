#![no_std]
mod test;

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env,
    token::Client as TokenClient,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub collateral: i128,
    pub borrow_amount: i128,
    pub lp_shares: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    TokenA, // USDC
    TokenB, // XLM/EUR
    LendingPool,
    MockAmm,
    Position(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    NoActivePosition = 2,
    PositionAlreadyExists = 3,
    InvalidLeverage = 4,
    InsufficientCollateral = 5,
    PositionHealthy = 6,
}

#[contractevent]
pub struct PositionOpened {
    pub user: Address,
    pub collateral: i128,
    pub borrow_amount: i128,
    pub lp_shares: i128,
}

#[contractevent]
pub struct PositionClosed {
    pub user: Address,
    pub payout: i128,
}

#[contractevent]
pub struct Liquidated {
    pub user: Address,
    pub liquidator: Address,
    pub payout_to_liquidator: i128,
}

// Client interfaces for inter-contract calls (ICC)
#[soroban_sdk::contractclient(name = "LendingPoolClient")]
pub trait LendingPool {
    fn borrow(env: &Env, user: &Address, amount: &i128);
    fn repay(env: &Env, user: &Address, amount: &i128);
}

#[soroban_sdk::contractclient(name = "MockAmmClient")]
pub trait MockAmm {
    fn swap(env: &Env, user: &Address, token_in: &Address, token_out: &Address, amount_in: &i128) -> i128;
    fn deposit(env: &Env, user: &Address, amount_a: &i128, amount_b: &i128) -> i128;
    fn withdraw(env: &Env, user: &Address, shares: &i128) -> (i128, i128);
}

#[contract]
pub struct LeverageEngineContract;

#[contractimpl]
impl LeverageEngineContract {
    pub fn __constructor(
        env: Env,
        admin: Address,
        token_a: Address,
        token_b: Address,
        pool: Address,
        amm: Address,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenA, &token_a);
        env.storage().instance().set(&DataKey::TokenB, &token_b);
        env.storage().instance().set(&DataKey::LendingPool, &pool);
        env.storage().instance().set(&DataKey::MockAmm, &amm);
    }

    // Opens a leveraged farming position
    // Leverage is scaled by 100: e.g. 3x leverage = 300, 5x leverage = 500
    pub fn open_position(
        env: Env,
        user: Address,
        collateral: i128,
        leverage: u32,
    ) -> Result<i128, Error> {
        user.require_auth();

        if collateral <= 0 {
            return Err(Error::InsufficientCollateral);
        }

        if leverage < 150 || leverage > 600 {
            return Err(Error::InvalidLeverage);
        }

        let user_key = DataKey::Position(user.clone());
        if env.storage().persistent().has(&user_key) {
            return Err(Error::PositionAlreadyExists);
        }

        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();
        let pool_addr: Address = env.storage().instance().get(&DataKey::LendingPool).unwrap();
        let amm_addr: Address = env.storage().instance().get(&DataKey::MockAmm).unwrap();

        let client_a = TokenClient::new(&env, &token_a);
        let client_b = TokenClient::new(&env, &token_b);

        // 1. Transfer user's USDC collateral to this contract
        client_a.transfer(&user, &env.current_contract_address(), &collateral);

        // 2. Borrow remaining USDC from Lending Pool
        let borrow_amount = (collateral * (leverage as i128 - 100)) / 100;
        let pool_client = LendingPoolClient::new(&env, &pool_addr);
        pool_client.borrow(&user, &borrow_amount);

        // Total USDC available = collateral + borrow_amount
        let total_usdc = collateral + borrow_amount;

        // 3. Swap half USDC for XLM/EUR via AMM
        let swap_amount = total_usdc / 2;
        // Transfer USDC to AMM first
        client_a.transfer(&env.current_contract_address(), &amm_addr, &swap_amount);

        let amm_client = MockAmmClient::new(&env, &amm_addr);
        let received_token_b = amm_client.swap(&env.current_contract_address(), &token_a, &token_b, &swap_amount);

        // 4. Deposit both USDC and XLM/EUR into AMM to get LP shares
        let deposit_a_amount = total_usdc - swap_amount;
        client_a.transfer(&env.current_contract_address(), &amm_addr, &deposit_a_amount);
        client_b.transfer(&env.current_contract_address(), &amm_addr, &received_token_b);

        let lp_shares = amm_client.deposit(&env.current_contract_address(), &deposit_a_amount, &received_token_b);

        // 5. Store position details
        let position = Position {
            collateral,
            borrow_amount,
            lp_shares,
        };
        env.storage().persistent().set(&user_key, &position);

        PositionOpened {
            user,
            collateral,
            borrow_amount,
            lp_shares,
        }.publish(&env);

        Ok(lp_shares)
    }

    // Closes and unwinds a leveraged farming position
    pub fn close_position(env: Env, user: Address) -> Result<i128, Error> {
        user.require_auth();

        let user_key = DataKey::Position(user.clone());
        let pos: Position = env.storage().persistent().get(&user_key).ok_or(Error::NoActivePosition)?;

        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();
        let pool_addr: Address = env.storage().instance().get(&DataKey::LendingPool).unwrap();
        let amm_addr: Address = env.storage().instance().get(&DataKey::MockAmm).unwrap();

        let client_a = TokenClient::new(&env, &token_a);
        let client_b = TokenClient::new(&env, &token_b);
        let amm_client = MockAmmClient::new(&env, &amm_addr);
        let pool_client = LendingPoolClient::new(&env, &pool_addr);

        // 1. Withdraw reserves from AMM
        let (withdrawn_a, withdrawn_b) = amm_client.withdraw(&env.current_contract_address(), &pos.lp_shares);

        // 2. Swap paired asset back to USDC
        client_b.transfer(&env.current_contract_address(), &amm_addr, &withdrawn_b);
        let swapped_a = amm_client.swap(&env.current_contract_address(), &token_b, &token_a, &withdrawn_b);

        let total_a = withdrawn_a + swapped_a;

        // 3. Repay borrow principal + simulated 5% interest
        let interest = pos.borrow_amount / 20; // 5%
        let debt_repayment = pos.borrow_amount + interest;

        // Transfer funds directly to pool first, then trigger pool repay recording
        client_a.transfer(&env.current_contract_address(), &pool_addr, &debt_repayment);
        pool_client.repay(&user, &debt_repayment);

        // 4. Return remaining USDC payout to the user
        let payout = if total_a > debt_repayment { total_a - debt_repayment } else { 0 };
        if payout > 0 {
            client_a.transfer(&env.current_contract_address(), &user, &payout);
        }

        // 5. Clean up position storage
        env.storage().persistent().remove(&user_key);

        PositionClosed {
            user,
            payout,
        }.publish(&env);

        Ok(payout)
    }

    // Liquidates a position if its health factor falls below 1.0 (100)
    pub fn liquidate(env: Env, user: Address, liquidator: Address) -> Result<(), Error> {
        liquidator.require_auth();

        let user_key = DataKey::Position(user.clone());
        let pos: Position = env.storage().persistent().get(&user_key).ok_or(Error::NoActivePosition)?;

        // Health factor: (Collateral Value * 80) / Debt
        let lp_value = pos.lp_shares;
        let health_factor = if pos.borrow_amount > 0 {
            (lp_value * 80) / pos.borrow_amount
        } else {
            1000 // Very healthy
        };

        if health_factor >= 100 {
            return Err(Error::PositionHealthy);
        }

        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();
        let pool_addr: Address = env.storage().instance().get(&DataKey::LendingPool).unwrap();
        let amm_addr: Address = env.storage().instance().get(&DataKey::MockAmm).unwrap();

        let client_a = TokenClient::new(&env, &token_a);
        let client_b = TokenClient::new(&env, &token_b);
        let amm_client = MockAmmClient::new(&env, &amm_addr);
        let pool_client = LendingPoolClient::new(&env, &pool_addr);

        // 1. Withdraw assets from AMM
        let (withdrawn_a, withdrawn_b) = amm_client.withdraw(&env.current_contract_address(), &pos.lp_shares);

        // 2. Swap paired asset back to USDC
        client_b.transfer(&env.current_contract_address(), &amm_addr, &withdrawn_b);
        let swapped_a = amm_client.swap(&env.current_contract_address(), &token_b, &token_a, &withdrawn_b);

        let total_a = withdrawn_a + swapped_a;

        // 3. Repay pool debt (repay principal + interest)
        let interest = pos.borrow_amount / 20; // 5%
        let debt_repayment = pos.borrow_amount + interest;

        // Transfer funds directly to pool first
        client_a.transfer(&env.current_contract_address(), &pool_addr, &debt_repayment);
        pool_client.repay(&user, &debt_repayment);

        // 4. Calculate liquidator payout (10% reward of remaining margin)
        let remaining = if total_a > debt_repayment { total_a - debt_repayment } else { 0 };
        let reward = remaining / 10; // 10% liquidator reward
        let user_refund = remaining - reward;

        if reward > 0 {
            client_a.transfer(&env.current_contract_address(), &liquidator, &reward);
        }
        if user_refund > 0 {
            client_a.transfer(&env.current_contract_address(), &user, &user_refund);
        }

        // 5. Clean up position storage
        env.storage().persistent().remove(&user_key);

        Liquidated {
            user,
            liquidator,
            payout_to_liquidator: reward,
        }.publish(&env);

        Ok(())
    }

    // Helper to query position details
    pub fn get_position(env: Env, user: Address) -> Option<Position> {
        let user_key = DataKey::Position(user);
        env.storage().persistent().get(&user_key)
    }

    // Helper to query health factor
    pub fn get_health_factor(env: Env, user: Address) -> u32 {
        let user_key = DataKey::Position(user);
        let pos: Option<Position> = env.storage().persistent().get(&user_key);
        match pos {
            None => 1000,
            Some(p) => {
                if p.borrow_amount == 0 {
                    1000
                } else {
                    ((p.lp_shares * 80) / p.borrow_amount) as u32
                }
            }
        }
    }
}
