-- Initialize the database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Task queue table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 5,
    payload JSONB,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority DESC, created_at ASC);
CREATE INDEX idx_tasks_type ON tasks(type);

-- Thought signatures table
CREATE TABLE IF NOT EXISTS thought_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100) NOT NULL,
    task_id UUID REFERENCES tasks(id),
    context_summary TEXT NOT NULL,
    decision_made TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    assumptions JSONB DEFAULT '[]',
    expected_outcomes JSONB DEFAULT '[]',
    actual_outcomes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_thought_signatures_agent ON thought_signatures(agent_name);
CREATE INDEX idx_thought_signatures_task ON thought_signatures(task_id);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement TEXT NOT NULL,
    category VARCHAR(100),
    confidence FLOAT NOT NULL,
    made_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    outcome VARCHAR(20), -- 'correct', 'incorrect', 'partial', 'unknown'
    outcome_details TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    source_papers JSONB DEFAULT '[]',
    related_claims JSONB DEFAULT '[]'
);

CREATE INDEX idx_predictions_outcome ON predictions(outcome);
CREATE INDEX idx_predictions_due_date ON predictions(due_date);

-- Human review queue
CREATE TABLE IF NOT EXISTS review_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_type VARCHAR(50) NOT NULL, -- 'contradiction', 'prediction', 'claim'
    item_id VARCHAR(200) NOT NULL,
    reason TEXT NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'modified'
    reviewer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_review_items_status ON review_items(status);
CREATE INDEX idx_review_items_type ON review_items(item_type);

-- Budget tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL, -- 'gemini', 'arxiv', etc.
    operation VARCHAR(100) NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd FLOAT DEFAULT 0,
    duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_usage_provider ON api_usage(provider);
CREATE INDEX idx_api_usage_created ON api_usage(created_at);

-- Orchestrator state
CREATE TABLE IF NOT EXISTS orchestrator_state (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
    state JSONB NOT NULL DEFAULT '{}',
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    report_content JSONB NOT NULL,
    summary TEXT,
    papers_analyzed INTEGER DEFAULT 0,
    claims_extracted INTEGER DEFAULT 0,
    contradictions_found INTEGER DEFAULT 0,
    predictions_made INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tasks table
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to orchestrator_state table
CREATE TRIGGER update_orchestrator_state_updated_at
    BEFORE UPDATE ON orchestrator_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
