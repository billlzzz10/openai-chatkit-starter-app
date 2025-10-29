-- core: users, organizations, org_members
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  settings JSONB,
  api_key_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- documents, chunks, embedding_meta
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_url TEXT,
  provider TEXT NOT NULL, -- upload|web|notion|drive|slack
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_ingest_at TIMESTAMP WITH TIME ZONE,
  meta JSONB,
  visibility TEXT DEFAULT 'private', -- private|shared|public
  archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_hash TEXT NOT NULL UNIQUE, -- sha256 normalized text
  text TEXT NOT NULL,
  token_count INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE embedding_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL UNIQUE REFERENCES chunks(id) ON DELETE CASCADE,
  vector_id TEXT NOT NULL, -- Qdrant point id (we use chunk_hash often)
  vector_length INT,
  provider TEXT NOT NULL, -- voyage|vertex|mistral
  cost_estimate_cents BIGINT DEFAULT 0,
  provenance JSONB, -- {request_id, source, created_by}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- templates, user_templates
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- agent_prompt|report|marketing|code_review|summary
  schema JSONB NOT NULL, -- JSON Schema for template inputs
  body TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  overrides JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, template_id)
);

-- agents: instances and steps
CREATE TABLE agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  kind TEXT, -- marketingAgent, summarizer, todoAgent, codeReviewer
  state TEXT DEFAULT 'idle', -- idle|running|paused|failed|completed
  plan JSONB, -- serialized plan
  toggles JSONB, -- per-instance toggles (auto/manual tools)
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_instances(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  input JSONB,
  output JSONB,
  status TEXT DEFAULT 'pending', -- pending|success|error
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- research_stock, agent memory long
CREATE TABLE research_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  summary TEXT,
  tags TEXT[],
  sources TEXT[],
  provenance JSONB,
  status TEXT DEFAULT 'draft', -- draft|approved|archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE agent_memory_long (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_instances(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  memory_type TEXT, -- fact|preference|context|decision
  content TEXT,
  importance INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_accessed TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- feedback, usage_records, audit_logs, toggle_config, dedup_lock
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT, -- document|chunk|agent|response
  target_id UUID,
  rating INT, -- 1..5
  correction JSONB,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT, -- embed|llm|search|ingest|template_use
  model TEXT,
  tokens INT,
  cost_estimate_cents BIGINT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action TEXT,
  target_type TEXT,
  target_id UUID,
  payload JSONB,
  ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE toggle_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT, -- user|org
  owner_id UUID,
  key TEXT,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(owner_type, owner_id, key)
);

CREATE TABLE dedup_lock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key TEXT UNIQUE,
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  owner TEXT
);

-- Indexes (critical)
CREATE INDEX idx_docs_owner ON documents(owner_id, created_at DESC);
CREATE INDEX idx_chunks_doc ON chunks(document_id, position);
CREATE INDEX idx_chunks_hash ON chunks(chunk_hash);
CREATE INDEX idx_embedding_chunk ON embedding_meta(chunk_id);
CREATE INDEX idx_usage_user_date ON usage_records(user_id, created_at DESC);
CREATE INDEX idx_feedback_target ON feedback(target_type, target_id);
