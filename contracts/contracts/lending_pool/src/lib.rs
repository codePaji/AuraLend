#![no_std]
mod test;

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env,
    token::Client as TokenClient,
};

// Storage keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Balance(Address),
    TotalLiquidity, // Cash reserve in contract
    TotalBorrowed,  // Debt outstanding
    LeverageEngine, // Address of the leverage engine
}

// Custom contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    InsufficientBalance = 2,
    InvalidAmount = 3,
    NotAuthorized = 4,
}

// Event structures
#[contractevent]
pub struct DepositEvent {
    pub user: Address,
    pub amount: i128,
}

#[contractevent]
pub struct WithdrawEvent {
    pub user: Address,
    pub amount: i128,
}

#[contractevent]
pub struct BorrowEvent {
    pub user: Address,
    pub amount: i128,
}

#[contractevent]
pub struct RepayEvent {
    pub user: Address,
    pub amount: i128,
}

// TTL Limits: ~1 day minimum threshold, ~30 days extension target
const MIN_TTL: u32 = 17280;
const EXTEND_TO: u32 = 518400;

#[contract]
pub struct LendingPoolContract;

#[contractimpl]
impl LendingPoolContract {
    // Protocol 22 constructor: atomic initialization
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalLiquidity, &0i128);
        env.storage().instance().set(&DataKey::TotalBorrowed, &0i128);
        
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);
    }

    // Set leverage engine address (Admin only)
    pub fn set_leverage_engine(env: Env, engine: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();

        env.storage().instance().set(&DataKey::LeverageEngine, &engine);
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);
        Ok(())
    }

    // Deposit collateral into the lending pool
    pub fn deposit(env: Env, user: Address, amount: i128) -> Result<i128, Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Load dependencies
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).ok_or(Error::NotInitialized)?;
        let client = TokenClient::new(&env, &token_addr);

        // Execute token transfer: user -> contract
        client.transfer(&user, &env.current_contract_address(), &amount);

        // Calculate and save user balance
        let user_key = DataKey::Balance(user.clone());
        let current_balance: i128 = env.storage().persistent().get(&user_key).unwrap_or(0);
        let new_balance = current_balance + amount;
        env.storage().persistent().set(&user_key, &new_balance);

        // Extend balance storage TTL
        env.storage().persistent().extend_ttl(&user_key, MIN_TTL, EXTEND_TO);

        // Update total pool liquidity (cash reserve)
        let total_key = DataKey::TotalLiquidity;
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        let new_total = current_total + amount;
        env.storage().instance().set(&total_key, &new_total);

        // Extend instance storage TTL
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);

        // Emit typed event
        DepositEvent { user, amount }.publish(&env);

        Ok(new_balance)
    }

    // Withdraw collateral from the lending pool
    pub fn withdraw(env: Env, user: Address, amount: i128) -> Result<i128, Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let user_key = DataKey::Balance(user.clone());
        let current_balance: i128 = env.storage().persistent().get(&user_key).unwrap_or(0);
        if current_balance < amount {
            return Err(Error::InsufficientBalance);
        }

        // Check if there is enough cash in the contract (total liquidity)
        let total_key = DataKey::TotalLiquidity;
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        if current_total < amount {
            return Err(Error::InsufficientBalance);
        }

        // Load dependencies
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).ok_or(Error::NotInitialized)?;
        let client = TokenClient::new(&env, &token_addr);

        // Execute token transfer: contract -> user
        client.transfer(&env.current_contract_address(), &user, &amount);

        // Update user balance
        let new_balance = current_balance - amount;
        if new_balance == 0 {
            env.storage().persistent().remove(&user_key);
        } else {
            env.storage().persistent().set(&user_key, &new_balance);
            env.storage().persistent().extend_ttl(&user_key, MIN_TTL, EXTEND_TO);
        }

        // Update total pool liquidity
        let new_total = current_total - amount;
        env.storage().instance().set(&total_key, &new_total);

        // Extend instance storage TTL
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);

        // Emit typed event
        WithdrawEvent { user, amount }.publish(&env);

        Ok(new_balance)
    }

    // Borrow assets from the pool (Callable only by the authorized Leverage Engine)
    pub fn borrow(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        // Validate caller is the leverage engine
        let leverage_engine: Address = env.storage().instance().get(&DataKey::LeverageEngine).ok_or(Error::NotAuthorized)?;
        leverage_engine.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Check cash reserve
        let total_key = DataKey::TotalLiquidity;
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        if current_total < amount {
            return Err(Error::InsufficientBalance);
        }

        // Load dependencies
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).ok_or(Error::NotInitialized)?;
        let client = TokenClient::new(&env, &token_addr);

        // Transfer funds: pool -> leverage engine
        client.transfer(&env.current_contract_address(), &leverage_engine, &amount);

        // Update balances
        let new_liquidity = current_total - amount;
        env.storage().instance().set(&total_key, &new_liquidity);

        let borrow_key = DataKey::TotalBorrowed;
        let current_borrowed: i128 = env.storage().instance().get(&borrow_key).unwrap_or(0);
        let new_borrowed = current_borrowed + amount;
        env.storage().instance().set(&borrow_key, &new_borrowed);

        // Extend instance storage TTL
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);

        // Emit borrow event
        BorrowEvent { user, amount }.publish(&env);

        Ok(())
    }

    // Repay assets back to the pool (Callable only by the authorized Leverage Engine)
    // Expects tokens to have already been transferred to this contract's address
    pub fn repay(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        let leverage_engine: Address = env.storage().instance().get(&DataKey::LeverageEngine).ok_or(Error::NotAuthorized)?;
        leverage_engine.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Update balances (tokens already transferred by leverage engine caller)
        let total_key = DataKey::TotalLiquidity;
        let current_total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
        let new_liquidity = current_total + amount;
        env.storage().instance().set(&total_key, &new_liquidity);

        let borrow_key = DataKey::TotalBorrowed;
        let current_borrowed: i128 = env.storage().instance().get(&borrow_key).unwrap_or(0);
        let new_borrowed = if current_borrowed < amount { 0 } else { current_borrowed - amount };
        env.storage().instance().set(&borrow_key, &new_borrowed);

        // Extend instance storage TTL
        env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);

        // Emit repay event
        RepayEvent { user, amount }.publish(&env);

        Ok(())
    }

    // Query borrow rate dynamically based on pool utilization rate: Rate = 2% + (Borrowed / TotalAssets) * 8%
    pub fn get_borrow_rate(env: Env) -> i128 {
        let borrowed = env.storage().instance().get(&DataKey::TotalBorrowed).unwrap_or(0i128);
        let liquidity = env.storage().instance().get(&DataKey::TotalLiquidity).unwrap_or(0i128);
        let total_assets = liquidity + borrowed;
        if total_assets == 0 {
            return 200_000; // 2.00% (7 decimals)
        }
        
        let base_rate = 200_000i128; // 2%
        let slope = 800_000i128;     // 8%
        
        // rate = base_rate + (borrowed * slope) / total_assets
        base_rate + (borrowed * slope) / total_assets
    }

    // Query balance of a specific user
    pub fn get_balance(env: Env, user: Address) -> i128 {
        let user_key = DataKey::Balance(user);
        env.storage().persistent().get(&user_key).unwrap_or(0)
    }

    // Query total pool liquidity (available cash)
    pub fn get_total_liquidity(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalLiquidity).unwrap_or(0)
    }

    // Query total borrowed debt
    pub fn get_total_borrowed(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalBorrowed).unwrap_or(0)
    }
}
