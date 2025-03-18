-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  signature TEXT PRIMARY KEY,
  slot BIGINT NOT NULL,
  error JSONB,
  fee BIGINT NOT NULL,
  logs JSONB NOT NULL,
  program_ids JSONB NOT NULL,
  accounts JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create program interactions table
CREATE TABLE IF NOT EXISTS program_interactions (
  transaction_signature TEXT REFERENCES transactions(signature),
  program_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_signature, program_id)
);

-- Create account activities table
CREATE TABLE IF NOT EXISTS account_activities (
  transaction_signature TEXT REFERENCES transactions(signature),
  account_address TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_signature, account_address)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_program_interactions_program_id ON program_interactions(program_id);
CREATE INDEX IF NOT EXISTS idx_account_activities_account_address ON account_activities(account_address); 