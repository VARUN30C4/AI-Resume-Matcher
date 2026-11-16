/**
 * Deterministic interview question generator based on skill taxonomy gaps.
 * Provides high-signal behavioral and technical prompts without requiring external LLM APIs.
 */

const SKILL_CUSTOM_QUESTIONS = {
  Python: [
    "How do you approach concurrency in Python (asyncio vs multiprocessing vs threading) when handling high-throughput I/O vs CPU-bound tasks?",
    "Can you share how you utilize Python's type hints and data validation (e.g. Pydantic) to maintain code reliability in production?",
  ],
  FastAPI: [
    "How do you design FastAPI dependency injection graphs for database sessions and authentication middleware?",
    "What strategies do you use in FastAPI to avoid blocking the async event loop with synchronous third-party libraries?",
  ],
  Docker: [
    "How do you structure multi-stage Docker builds to minimize final image size and reduce security vulnerability attack surface?",
    "Describe an issue you faced with container networking, volume mounts, or permission boundaries in a CI/CD environment.",
  ],
  PostgreSQL: [
    "How do you diagnose and optimize a slow PostgreSQL query using EXPLAIN (ANALYZE, BUFFERS)?",
    "What considerations do you keep in mind regarding connection pooling, indexing strategies, and database transactions under high write load?",
  ],
  SQL: [
    "Explain how window functions and common table expressions (CTEs) can simplify complex relational reporting queries.",
    "How do you ensure data integrity and avoid race conditions when updating inventory or financial records concurrently?",
  ],
  "Machine Learning": [
    "How do you evaluate whether a problem is best solved by classical heuristics, traditional ML models, or deep learning?",
    "What metrics and validation frameworks do you rely on to detect data drift and maintain model accuracy post-deployment?",
  ],
  NLP: [
    "How do dense vector embeddings differ from sparse representations (e.g., TF-IDF / BM25), and when would you combine them?",
    "What techniques do you employ to handle out-of-vocabulary terms or domain-specific jargon in text classification?",
  ],
  Kubernetes: [
    "How do you configure Kubernetes liveness and readiness probes to prevent cascading service outages during traffic spikes?",
    "Describe how you manage configmaps, secrets, and horizontal pod autoscalers (HPA) in a production cluster.",
  ],
  AWS: [
    "Walk us through how you design a secure, least-privilege IAM policy and VPC architecture for microservices.",
    "How do you balance cost efficiency against high availability across multiple availability zones in AWS?",
  ],
  "REST APIs": [
    "What principles do you follow when versioning REST APIs and designing idempotent endpoints for distributed consumers?",
    "How do you handle graceful rate limiting and error response formatting across public endpoints?",
  ],
};

export function getInterviewQuestionsForSkill(skillName) {
  // Check exact custom match
  if (SKILL_CUSTOM_QUESTIONS[skillName]) {
    return SKILL_CUSTOM_QUESTIONS[skillName];
  }

  // Check case-insensitive or partial match
  const match = Object.keys(SKILL_CUSTOM_QUESTIONS).find(
    (k) => k.toLowerCase() === skillName.toLowerCase()
  );
  if (match) {
    return SKILL_CUSTOM_QUESTIONS[match];
  }

  // General high-signal behavioral + technical templates
  return [
    `Can you describe a production project where you utilized ${skillName}, detailing the architectural decisions and key trade-offs you made?`,
    `When evaluating performance, reliability, and maintainability with ${skillName}, what common pitfalls or antipatterns do you proactively guard against?`,
  ];
}
