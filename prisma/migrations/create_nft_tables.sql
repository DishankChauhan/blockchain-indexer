-- Create NFT events table
CREATE TABLE IF NOT EXISTS nft_events (
  signature TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  mint TEXT NOT NULL,
  owner TEXT,
  price NUMERIC,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nft_events_mint ON nft_events(mint);
CREATE INDEX IF NOT EXISTS idx_nft_events_owner ON nft_events(owner);
CREATE INDEX IF NOT EXISTS idx_nft_events_timestamp ON nft_events(timestamp); 