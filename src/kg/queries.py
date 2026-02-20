"""Cypher query builders for Neo4j operations."""


class CypherQueries:
    """Collection of Cypher queries for the knowledge graph."""

    # Schema setup
    SETUP_CONSTRAINTS = """
    CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE;
    CREATE CONSTRAINT paper_arxiv_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.arxiv_id IS UNIQUE;
    CREATE CONSTRAINT claim_id IF NOT EXISTS FOR (c:Claim) REQUIRE c.id IS UNIQUE;
    CREATE CONSTRAINT method_id IF NOT EXISTS FOR (m:Method) REQUIRE m.id IS UNIQUE;
    CREATE CONSTRAINT method_name IF NOT EXISTS FOR (m:Method) REQUIRE m.name IS UNIQUE;
    CREATE CONSTRAINT trend_id IF NOT EXISTS FOR (t:Trend) REQUIRE t.id IS UNIQUE;
    CREATE CONSTRAINT prediction_id IF NOT EXISTS FOR (p:Prediction) REQUIRE p.id IS UNIQUE;
    """

    SETUP_INDEXES = """
    CREATE INDEX paper_published IF NOT EXISTS FOR (p:Paper) ON (p.published_date);
    CREATE INDEX paper_analyzed IF NOT EXISTS FOR (p:Paper) ON (p.analyzed);
    CREATE INDEX claim_status IF NOT EXISTS FOR (c:Claim) ON (c.status);
    CREATE INDEX claim_category IF NOT EXISTS FOR (c:Claim) ON (c.category);
    CREATE INDEX trend_direction IF NOT EXISTS FOR (t:Trend) ON (t.direction);
    CREATE INDEX prediction_outcome IF NOT EXISTS FOR (p:Prediction) ON (p.outcome);
    CREATE INDEX prediction_due IF NOT EXISTS FOR (p:Prediction) ON (p.due_date);
    """

    # Node operations
    @staticmethod
    def create_node(label: str) -> str:
        return f"""
        CREATE (n:{label} $props)
        RETURN n
        """

    @staticmethod
    def merge_node(label: str, key_property: str = "id") -> str:
        return f"""
        MERGE (n:{label} {{{key_property}: $props.{key_property}}})
        SET n += $props
        RETURN n
        """

    @staticmethod
    def get_node(label: str, key_property: str = "id") -> str:
        return f"""
        MATCH (n:{label} {{{key_property}: $value}})
        RETURN n
        """

    @staticmethod
    def get_nodes(label: str, limit: int = 100) -> str:
        return f"""
        MATCH (n:{label})
        RETURN n
        ORDER BY n.created_at DESC
        LIMIT {limit}
        """

    @staticmethod
    def delete_node(label: str) -> str:
        return f"""
        MATCH (n:{label} {{id: $id}})
        DETACH DELETE n
        """

    # Relationship operations
    @staticmethod
    def create_relationship(
        source_label: str,
        target_label: str,
        rel_type: str,
    ) -> str:
        return f"""
        MATCH (source:{source_label} {{id: $source_id}})
        MATCH (target:{target_label} {{id: $target_id}})
        CREATE (source)-[r:{rel_type} $props]->(target)
        RETURN r
        """

    @staticmethod
    def merge_relationship(
        source_label: str,
        target_label: str,
        rel_type: str,
    ) -> str:
        return f"""
        MATCH (source:{source_label} {{id: $source_id}})
        MATCH (target:{target_label} {{id: $target_id}})
        MERGE (source)-[r:{rel_type}]->(target)
        SET r += $props
        RETURN r
        """

    # Paper queries
    GET_UNANALYZED_PAPERS = """
    MATCH (p:Paper {analyzed: false})
    RETURN p
    ORDER BY p.published_date DESC
    LIMIT $limit
    """

    GET_PAPERS_BY_DATE_RANGE = """
    MATCH (p:Paper)
    WHERE p.published_date >= $start_date AND p.published_date <= $end_date
    RETURN p
    ORDER BY p.published_date DESC
    """

    GET_PAPER_WITH_CLAIMS = """
    MATCH (p:Paper {id: $paper_id})
    OPTIONAL MATCH (p)-[:CONTAINS]->(c:Claim)
    OPTIONAL MATCH (p)-[:USES_METHOD]->(m:Method)
    RETURN p, collect(DISTINCT c) as claims, collect(DISTINCT m) as methods
    """

    # Claim queries
    GET_CLAIMS_BY_CATEGORY = """
    MATCH (c:Claim {category: $category})
    RETURN c
    ORDER BY c.created_at DESC
    LIMIT $limit
    """

    GET_CONTESTED_CLAIMS = """
    MATCH (c:Claim {status: 'contested'})
    RETURN c
    ORDER BY c.created_at DESC
    LIMIT $limit
    """

    GET_CLAIMS_FOR_PAPER = """
    MATCH (p:Paper {id: $paper_id})-[:CONTAINS]->(c:Claim)
    RETURN c
    ORDER BY c.confidence DESC
    """

    # Contradiction queries
    GET_CONTRADICTIONS = """
    MATCH (c1:Claim)-[r:CONTRADICTS]->(c2:Claim)
    RETURN c1, r, c2
    ORDER BY r.strength DESC
    LIMIT $limit
    """

    GET_CONTRADICTIONS_FOR_CLAIM = """
    MATCH (c:Claim {id: $claim_id})-[r:CONTRADICTS]-(other:Claim)
    RETURN other, r
    ORDER BY r.strength DESC
    """

    FIND_POTENTIAL_CONTRADICTIONS = """
    MATCH (c1:Claim), (c2:Claim)
    WHERE c1.id < c2.id
    AND c1.category = c2.category
    AND NOT (c1)-[:CONTRADICTS]-(c2)
    AND NOT (c1)-[:SUPPORTS]-(c2)
    RETURN c1, c2
    LIMIT $limit
    """

    # Trend queries
    GET_ACTIVE_TRENDS = """
    MATCH (t:Trend)
    WHERE t.direction IN ['rising', 'stable']
    RETURN t
    ORDER BY t.velocity DESC
    LIMIT $limit
    """

    GET_RISING_TRENDS = """
    MATCH (t:Trend {direction: 'rising'})
    RETURN t
    ORDER BY t.velocity DESC
    LIMIT $limit
    """

    GET_TREND_WITH_DETAILS = """
    MATCH (t:Trend {id: $trend_id})
    OPTIONAL MATCH (t)-[:INVOLVES]->(c:Claim)
    OPTIONAL MATCH (t)-[:INVOLVES]->(m:Method)
    RETURN t, collect(DISTINCT c) as claims, collect(DISTINCT m) as methods
    """

    UPDATE_TREND_VELOCITY = """
    MATCH (t:Trend {id: $trend_id})
    SET t.velocity = $velocity,
        t.direction = $direction,
        t.last_updated = datetime()
    RETURN t
    """

    # Prediction queries
    GET_PENDING_PREDICTIONS = """
    MATCH (p:Prediction {outcome: 'pending'})
    RETURN p
    ORDER BY p.due_date ASC
    """

    GET_DUE_PREDICTIONS = """
    MATCH (p:Prediction {outcome: 'pending'})
    WHERE p.due_date <= datetime()
    RETURN p
    ORDER BY p.due_date ASC
    """

    UPDATE_PREDICTION_OUTCOME = """
    MATCH (p:Prediction {id: $prediction_id})
    SET p.outcome = $outcome,
        p.outcome_details = $outcome_details,
        p.resolved_at = datetime()
    RETURN p
    """

    GET_PREDICTION_ACCURACY = """
    MATCH (p:Prediction)
    WHERE p.outcome <> 'pending'
    RETURN
        count(p) as total,
        sum(CASE WHEN p.outcome = 'correct' THEN 1 ELSE 0 END) as correct,
        sum(CASE WHEN p.outcome = 'incorrect' THEN 1 ELSE 0 END) as incorrect,
        sum(CASE WHEN p.outcome = 'partial' THEN 1 ELSE 0 END) as partial,
        avg(p.confidence) as avg_confidence
    """

    # Method queries
    GET_POPULAR_METHODS = """
    MATCH (m:Method)
    RETURN m
    ORDER BY m.paper_count DESC
    LIMIT $limit
    """

    GET_NOVEL_METHODS = """
    MATCH (m:Method {is_novel: true})
    RETURN m
    ORDER BY m.created_at DESC
    LIMIT $limit
    """

    INCREMENT_METHOD_COUNT = """
    MATCH (m:Method {id: $method_id})
    SET m.paper_count = m.paper_count + 1
    RETURN m
    """

    # Graph statistics - use OPTIONAL MATCH to handle empty collections
    GET_GRAPH_STATS = """
    OPTIONAL MATCH (p:Paper) WITH count(p) as papers
    OPTIONAL MATCH (c:Claim) WITH papers, count(c) as claims
    OPTIONAL MATCH (m:Method) WITH papers, claims, count(m) as methods
    OPTIONAL MATCH (tech:Technique) WITH papers, claims, methods, count(tech) as techniques
    OPTIONAL MATCH (t:Trend) WITH papers, claims, methods, techniques, count(t) as trends
    OPTIONAL MATCH (pred:Prediction) WITH papers, claims, methods, techniques, trends, count(pred) as predictions
    OPTIONAL MATCH ()-[r:CONTRADICTS]->() WITH papers, claims, methods, techniques, trends, predictions, count(r) as contradictions
    RETURN papers, claims, methods, techniques, trends, predictions, contradictions
    """

    GET_WEEKLY_STATS = """
    MATCH (p:Paper)
    WHERE p.created_at >= datetime($start_date)
    WITH count(p) as new_papers

    MATCH (c:Claim)
    WHERE c.created_at >= datetime($start_date)
    WITH new_papers, count(c) as new_claims

    MATCH ()-[r:CONTRADICTS]->()
    WHERE r.created_at >= datetime($start_date)
    WITH new_papers, new_claims, count(r) as new_contradictions

    MATCH (pred:Prediction)
    WHERE pred.made_at >= datetime($start_date)
    WITH new_papers, new_claims, new_contradictions, count(pred) as new_predictions

    RETURN new_papers, new_claims, new_contradictions, new_predictions
    """

    # Similarity and search
    FIND_SIMILAR_CLAIMS = """
    MATCH (c:Claim {id: $claim_id})
    MATCH (other:Claim)
    WHERE other.id <> c.id AND other.category = c.category
    RETURN other
    LIMIT $limit
    """

    # Subgraph queries
    GET_PAPER_SUBGRAPH = """
    MATCH (p:Paper {id: $paper_id})
    OPTIONAL MATCH (p)-[r1:CONTAINS]->(c:Claim)
    OPTIONAL MATCH (p)-[r2:USES_METHOD]->(m:Method)
    OPTIONAL MATCH (c)-[r3:CONTRADICTS]-(other_claim:Claim)
    RETURN p, r1, c, r2, m, r3, other_claim
    """

    GET_TREND_SUBGRAPH = """
    MATCH (t:Trend {id: $trend_id})
    OPTIONAL MATCH (t)-[r1:INVOLVES]->(c:Claim)
    OPTIONAL MATCH (t)-[r2:INVOLVES]->(m:Method)
    OPTIONAL MATCH (pred:Prediction)-[r3:BASED_ON]->(t)
    RETURN t, r1, c, r2, m, r3, pred
    """
