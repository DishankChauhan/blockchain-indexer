-- Create token transfers table
CREATE TABLE IF NOT EXISTS token_transfers (
  signature TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  mint TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_transfers_mint ON token_transfers(mint);
CREATE INDEX IF NOT EXISTS idx_token_transfers_from_address ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_to_address ON token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_timestamp ON token_transfers(timestamp); 