-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Paper embeddings table
CREATE TABLE IF NOT EXISTS paper_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id VARCHAR(255) UNIQUE NOT NULL,
    embedding vector(768) NOT NULL,
    title TEXT,
    abstract_preview TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Claim embeddings table
CREATE TABLE IF NOT EXISTS claim_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id VARCHAR(255) UNIQUE NOT NULL,
    paper_id VARCHAR(255),
    embedding vector(768) NOT NULL,
    statement TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Technique embeddings table
CREATE TABLE IF NOT EXISTS technique_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technique_id VARCHAR(255) UNIQUE NOT NULL,
    embedding vector(768) NOT NULL,
    name TEXT,
    description TEXT,
    formula TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat conversation history table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    sources JSONB,  -- Array of source references
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create IVFFlat indexes for fast similarity search
-- Note: indexes are created after some data is inserted for better performance
-- For now, create basic btree indexes on foreign keys

CREATE INDEX IF NOT EXISTS idx_paper_embeddings_paper_id ON paper_embeddings(paper_id);
CREATE INDEX IF NOT EXISTS idx_claim_embeddings_claim_id ON claim_embeddings(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_embeddings_paper_id ON claim_embeddings(paper_id);
CREATE INDEX IF NOT EXISTS idx_claim_embeddings_category ON claim_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_technique_embeddings_technique_id ON technique_embeddings(technique_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- Function to create vector indexes when we have enough data
-- Call this after inserting at least 100 records
CREATE OR REPLACE FUNCTION create_vector_indexes()
RETURNS void AS $$
BEGIN
    -- Drop existing vector indexes if they exist
    DROP INDEX IF EXISTS idx_paper_embeddings_vector;
    DROP INDEX IF EXISTS idx_claim_embeddings_vector;
    DROP INDEX IF EXISTS idx_technique_embeddings_vector;

    -- Create IVFFlat indexes for cosine similarity search
    -- lists parameter = sqrt(number of rows) is a good starting point
    CREATE INDEX idx_paper_embeddings_vector
        ON paper_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);

    CREATE INDEX idx_claim_embeddings_vector
        ON claim_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);

    CREATE INDEX idx_technique_embeddings_vector
        ON technique_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
END;
$$ LANGUAGE plpgsql;
