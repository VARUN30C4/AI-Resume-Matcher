"""Skills taxonomy used for extraction and for skill-level semantic matching.

Each skill has:
  * a canonical name
  * a category (used by the offline embedder as a "concept" token)
  * aliases (surface forms found in text). A leading "!" marks a case-sensitive alias.
  * ``implies``: more general skills a candidate very likely has if they list this one
    (e.g. FastAPI -> Python). Credit 0.8 when the JD asks for the general skill.
  * ``related``: sibling skills in the same family (e.g. PostgreSQL ~ MySQL). Credit 0.5.

The taxonomy is deliberately small and readable. It is the *first* semantic layer;
embeddings (see embeddings.py) are the second.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

CREDIT_EXACT = 1.0
CREDIT_IMPLIED = 0.8
CREDIT_RELATED = 0.5


@dataclass
class Skill:
    name: str
    category: str
    aliases: list[str] = field(default_factory=list)
    implies: list[str] = field(default_factory=list)
    related: list[str] = field(default_factory=list)


_RAW: list[tuple] = [
    # name, category, aliases, implies, related
    # ---- languages
    ("Python", "language", ["python3", "py"], [], ["R"]),
    ("Java", "language", [], [], ["Kotlin", "C#", "Scala"]),
    ("JavaScript", "language", ["js", "ecmascript", "es6"], [], ["TypeScript"]),
    ("TypeScript", "language", ["ts"], ["JavaScript"], []),
    ("C++", "language", ["cpp"], [], ["C#", "Rust"]),
    ("C#", "language", ["csharp", "c sharp"], [], ["Java"]),
    ("Go", "language", ["golang"], [], ["Rust"]),
    ("Rust", "language", [], [], ["Go", "C++"]),
    ("Kotlin", "language", [], [], ["Java"]),
    ("Swift", "language", ["!Swift"], [], ["Kotlin"]),
    ("PHP", "language", [], [], []),
    ("Ruby", "language", ["ruby on rails", "rails"], [], []),
    ("Scala", "language", [], [], ["Java"]),
    ("R", "language", ["r programming", "r language", "rstudio"], [], ["Python"]),
    ("SQL", "language", ["structured query language", "t-sql", "pl/sql", "plsql"], [], []),
    ("Bash", "language", ["shell scripting", "shell script", "bash scripting"], [], ["Linux"]),
    # ---- backend frameworks
    ("FastAPI", "backend_framework", ["fast api"], ["Python", "REST APIs"], ["Flask", "Django"]),
    ("Flask", "backend_framework", [], ["Python"], ["FastAPI", "Django"]),
    ("Django", "backend_framework", ["django rest framework", "drf"], ["Python"], ["Flask", "FastAPI"]),
    ("Spring Boot", "backend_framework", ["spring-boot", "springboot"], ["Spring", "Java"], ["Django", "Node.js"]),
    ("Spring", "backend_framework", ["spring framework", "spring mvc", "spring data", "spring security", "!Spring"], ["Java"], []),
    ("Node.js", "backend_framework", ["node", "nodejs", "node js"], ["JavaScript"], ["Express.js"]),
    ("Express.js", "backend_framework", ["expressjs", "express js"], ["Node.js", "JavaScript"], []),
    (".NET", "backend_framework", ["dotnet", "asp.net", "asp.net core"], ["C#"], ["Spring Boot"]),
    ("Laravel", "backend_framework", [], ["PHP"], []),
    ("Hibernate", "backend_framework", ["jpa"], ["Java"], ["SQLAlchemy"]),
    ("SQLAlchemy", "backend_framework", ["sql alchemy"], ["Python", "SQL"], ["Hibernate"]),
    # ---- frontend
    ("React", "frontend", ["react.js", "reactjs", "react js"], ["JavaScript"], ["Angular", "Vue.js"]),
    ("Angular", "frontend", ["angularjs", "angular.js"], ["TypeScript"], ["React", "Vue.js"]),
    ("Vue.js", "frontend", ["vue", "vuejs"], ["JavaScript"], ["React", "Angular"]),
    ("Next.js", "frontend", ["nextjs", "next js"], ["React"], []),
    ("HTML", "frontend", ["html5"], [], ["CSS"]),
    ("CSS", "frontend", ["css3", "scss", "sass"], [], ["HTML", "Tailwind CSS"]),
    ("Tailwind CSS", "frontend", ["tailwind", "tailwindcss"], ["CSS"], []),
    ("Redux", "frontend", ["redux toolkit"], ["React"], []),
    # ---- APIs / architecture
    ("REST APIs", "api", ["rest", "restful", "rest api", "restful api", "restful apis", "restful services", "rest services", "web services"], [], ["GraphQL", "gRPC"]),
    ("GraphQL", "api", [], [], ["REST APIs"]),
    ("gRPC", "api", ["grpc", "protobuf", "protocol buffers"], [], ["REST APIs"]),
    ("Microservices", "architecture", ["microservice", "micro-services", "microservices architecture"], [], ["REST APIs"]),
    ("WebSockets", "api", ["websocket", "web sockets"], [], []),
    ("System Design", "architecture", ["distributed systems", "scalable systems", "software architecture"], [], ["Microservices"]),
    # ---- databases
    ("PostgreSQL", "database", ["postgres", "psql", "postgresql"], ["SQL"], ["MySQL", "SQL Server", "Oracle"]),
    ("MySQL", "database", ["mariadb"], ["SQL"], ["PostgreSQL"]),
    ("MongoDB", "database", ["mongo", "mongo db", "mongoose"], [], ["DynamoDB", "Cassandra"]),
    ("SQLite", "database", [], ["SQL"], ["PostgreSQL"]),
    ("Redis", "database", [], [], ["Memcached"]),
    ("Memcached", "database", [], [], ["Redis"]),
    ("Elasticsearch", "database", ["elastic search", "opensearch", "elk stack"], [], []),
    ("Oracle", "database", ["oracle db", "oracle database"], ["SQL"], ["PostgreSQL"]),
    ("SQL Server", "database", ["mssql", "ms sql", "microsoft sql server"], ["SQL"], ["PostgreSQL"]),
    ("DynamoDB", "database", ["dynamo db"], [], ["MongoDB"]),
    ("Cassandra", "database", [], [], ["MongoDB"]),
    # ---- cloud / devops
    ("AWS", "cloud", ["amazon web services", "ec2", "aws lambda", "amazon s3", "sagemaker"], [], ["Azure", "GCP"]),
    ("Azure", "cloud", ["microsoft azure", "azure devops", "azure openai", "azure ml"], [], ["AWS", "GCP"]),
    ("GCP", "cloud", ["google cloud", "google cloud platform", "vertex ai", "bigquery"], [], ["AWS", "Azure"]),
    ("Docker", "devops", ["containerization", "containerisation", "containerized", "containerised", "docker compose", "dockerfile", "docker-compose"], [], ["Kubernetes"]),
    ("Kubernetes", "devops", ["k8s", "helm", "eks", "aks", "gke"], [], ["Docker"]),
    ("Terraform", "devops", ["infrastructure as code", "iac"], [], ["Ansible"]),
    ("Ansible", "devops", [], [], ["Terraform"]),
    ("CI/CD", "devops", ["cicd", "ci cd", "ci/cd pipelines", "continuous integration", "continuous delivery", "continuous deployment", "github actions", "gitlab ci", "jenkins", "circleci"], [], ["Docker"]),
    ("Git", "tools", ["github", "gitlab", "bitbucket", "version control"], [], []),
    ("Linux", "tools", ["unix", "ubuntu"], [], ["Bash"]),
    ("Nginx", "devops", [], [], []),
    ("Kafka", "messaging", ["apache kafka"], [], ["RabbitMQ"]),
    ("RabbitMQ", "messaging", ["rabbit mq", "message queue", "message queues"], [], ["Kafka"]),
    ("Celery", "messaging", [], ["Python"], ["RabbitMQ"]),
    ("Airflow", "data", ["apache airflow"], ["Python"], ["ETL"]),
    # ---- ML / AI
    ("Machine Learning", "ml_ai", ["ml", "machine-learning", "predictive modeling", "predictive modelling", "supervised learning", "unsupervised learning"], [], ["Deep Learning", "Data Science"]),
    ("Deep Learning", "ml_ai", ["neural networks", "neural network", "cnn", "rnn", "lstm"], ["Machine Learning"], ["Machine Learning"]),
    ("NLP", "ml_ai", ["natural language processing", "text mining", "text classification", "named entity recognition", "ner", "sentiment analysis", "text analytics"], ["Machine Learning"], ["LLMs", "Computer Vision"]),
    ("Computer Vision", "ml_ai", ["image processing", "object detection", "image classification"], ["Machine Learning"], ["NLP"]),
    ("TensorFlow", "ml_ai", ["tf", "tensorflow 2"], ["Deep Learning", "Python"], ["PyTorch", "Keras"]),
    ("PyTorch", "ml_ai", ["pytorch lightning", "torch"], ["Deep Learning", "Python"], ["TensorFlow", "Keras"]),
    ("Keras", "ml_ai", [], ["Deep Learning"], ["TensorFlow", "PyTorch"]),
    ("scikit-learn", "ml_ai", ["sklearn", "scikit learn"], ["Machine Learning", "Python"], ["XGBoost"]),
    ("XGBoost", "ml_ai", ["lightgbm", "catboost", "gradient boosting"], ["Machine Learning"], ["scikit-learn"]),
    ("Hugging Face", "ml_ai", ["huggingface", "hugging face transformers", "transformers library"], ["NLP", "Deep Learning"], ["PyTorch"]),
    ("BERT", "ml_ai", ["roberta", "distilbert", "transformer models", "transformers"], ["NLP", "Deep Learning"], ["Hugging Face"]),
    ("spaCy", "ml_ai", ["spacy"], ["NLP", "Python"], ["NLTK"]),
    ("NLTK", "ml_ai", [], ["NLP", "Python"], ["spaCy"]),
    ("Sentence Transformers", "ml_ai", ["sentence-transformers", "sbert", "sentence embeddings", "text embeddings", "embeddings"], ["NLP"], ["Hugging Face", "Vector Databases"]),
    ("LLMs", "ml_ai", ["llm", "large language models", "large language model", "gpt", "gpt-4", "openai api", "generative ai", "genai", "gen ai", "gemini", "llama"], ["NLP"], ["Prompt Engineering", "RAG"]),
    ("RAG", "ml_ai", ["retrieval augmented generation", "retrieval-augmented generation", "rag pipeline", "rag pipelines"], ["LLMs"], ["Vector Databases", "LLMs"]),
    ("LangChain", "ml_ai", ["langgraph", "llamaindex", "llama index"], ["LLMs"], ["RAG"]),
    ("Prompt Engineering", "ml_ai", ["prompt design", "prompt engineering"], ["LLMs"], ["LLMs"]),
    ("Vector Databases", "ml_ai", ["pinecone", "faiss", "chroma", "chromadb", "weaviate", "qdrant", "milvus", "pgvector", "vector db", "vector database", "vector search", "semantic search"], [], ["Sentence Transformers", "RAG"]),
    ("MLOps", "ml_ai", ["mlflow", "model deployment", "model serving", "kubeflow"], ["Machine Learning"], ["Docker"]),
    ("OpenCV", "ml_ai", ["cv2"], ["Computer Vision"], []),
    ("Data Science", "ml_ai", ["data scientist"], [], ["Machine Learning", "Statistics"]),
    # ---- data
    ("Pandas", "data", [], ["Python"], ["NumPy"]),
    ("NumPy", "data", ["numpy"], ["Python"], ["Pandas"]),
    ("Spark", "data", ["pyspark", "apache spark"], [], ["Hadoop"]),
    ("Hadoop", "data", ["hdfs", "mapreduce", "hive"], [], ["Spark"]),
    ("Power BI", "data", ["powerbi"], ["Data Visualization"], ["Tableau"]),
    ("Tableau", "data", [], ["Data Visualization"], ["Power BI"]),
    ("Data Analysis", "data", ["data analytics", "exploratory data analysis", "eda"], [], ["Statistics"]),
    ("Data Engineering", "data", ["data pipelines", "data pipeline", "data warehousing", "data warehouse"], [], ["ETL"]),
    ("ETL", "data", ["elt"], [], ["Data Engineering", "Airflow"]),
    ("Statistics", "data", ["statistical analysis", "hypothesis testing", "statistical modeling"], [], ["Data Analysis"]),
    ("Excel", "data", ["!Excel", "ms excel", "microsoft excel", "advanced excel"], [], []),
    ("Data Visualization", "data", ["data visualisation", "matplotlib", "seaborn", "plotly"], [], ["Power BI", "Tableau"]),
    # ---- testing
    ("Pytest", "testing", ["py.test"], ["Python", "Unit Testing"], ["JUnit"]),
    ("JUnit", "testing", ["junit5", "mockito"], ["Java", "Unit Testing"], ["Pytest"]),
    ("Unit Testing", "testing", ["unit tests", "unit test", "test driven development", "tdd", "automated testing", "test automation"], [], []),
    ("Selenium", "testing", ["cypress", "playwright"], [], ["Unit Testing"]),
    # ---- practices
    ("Agile", "practice", ["scrum", "kanban", "sprint planning"], [], []),
    ("OOP", "practice", ["object oriented programming", "object-oriented programming", "object oriented design", "oops"], [], []),
    ("Data Structures", "practice", ["data structures and algorithms", "dsa", "algorithms"], [], []),
    ("Design Patterns", "practice", ["solid principles"], [], ["OOP"]),
    ("Authentication", "practice", ["oauth", "oauth2", "jwt", "sso", "openid connect"], [], []),
]


@lru_cache(maxsize=1)
def taxonomy() -> dict[str, Skill]:
    skills: dict[str, Skill] = {}
    for name, cat, aliases, implies, related in _RAW:
        skills[name] = Skill(name, cat, list(aliases), list(implies), list(related))
    # make "related" symmetric
    for s in list(skills.values()):
        for r in s.related:
            if r in skills and s.name not in skills[r].related:
                skills[r].related.append(s.name)
    return skills


_BOUND_L = r"(?<![\w+#])"
_BOUND_R = r"(?![\w+#])"


@lru_cache(maxsize=1)
def _compiled() -> list[tuple[str, re.Pattern]]:
    out: list[tuple[str, re.Pattern]] = []
    for s in taxonomy().values():
        ci, cs = [s.name], []
        for a in s.aliases:
            (cs if a.startswith("!") else ci).append(a.lstrip("!"))
        # the canonical name itself is case-insensitive unless it is listed as case-sensitive
        if any(a.lstrip("!") == s.name and a.startswith("!") for a in s.aliases):
            ci.remove(s.name)
        for terms, flags in ((ci, re.I), (cs, 0)):
            terms = sorted({t for t in terms if t}, key=len, reverse=True)
            if not terms:
                continue
            body = "|".join(re.escape(t).replace(r"\ ", r"[\s\-]+") for t in terms)
            extra = r"(?!\s+(?:\d{4}|semester|break|term|season))" if s.name == "Spring" else ""
            out.append((s.name, re.compile(_BOUND_L + "(?:" + body + ")" + _BOUND_R + extra, flags)))
    return out


def extract_skills(text: str) -> dict[str, int]:
    """Return {canonical_skill: mention_count} found in ``text``."""
    found: dict[str, int] = {}
    for name, rx in _compiled():
        n = len(rx.findall(text))
        if n:
            found[name] = found.get(name, 0) + n
    return found


def skill_mentions(text: str) -> list[tuple[int, int, str]]:
    """All (start, end, canonical_skill) mentions in reading order, without overlaps."""
    hits = []
    for name, rx in _compiled():
        for m in rx.finditer(text):
            hits.append((m.start(), m.end(), name))
    hits.sort(key=lambda h: (h[0], -(h[1] - h[0])))
    out, last_end = [], -1
    for h in hits:
        if h[0] >= last_end:
            out.append(h)
            last_end = h[1]
    return out


GROUP_SEP = " / "


def category_of(skill: str) -> str:
    s = taxonomy().get(skill)
    return s.category if s else "other"


def skill_credit(jd_skill: str, resume_skills: set[str]) -> tuple[float, str, str | None]:
    """Credit a candidate gets for one JD skill.

    Returns (credit, kind, evidence_skill) with kind in exact|implied|related|none.
    """
    if GROUP_SEP in jd_skill:  # "FastAPI / Flask / Django": any one of them satisfies the requirement
        return max((skill_credit(m, resume_skills) for m in jd_skill.split(GROUP_SEP)), key=lambda r: r[0])
    tax = taxonomy()
    if jd_skill in resume_skills:
        return CREDIT_EXACT, "exact", jd_skill
    # candidate lists a more specific skill that implies the requested one
    best: tuple[float, str, str | None] = (0.0, "none", None)
    for rs in resume_skills:
        sk = tax.get(rs)
        if not sk:
            continue
        if jd_skill in sk.implies and CREDIT_IMPLIED > best[0]:
            best = (CREDIT_IMPLIED, "implied", rs)
    if best[0]:
        return best
    jd = tax.get(jd_skill)
    if jd:
        for rs in resume_skills:
            if rs in jd.related and CREDIT_RELATED > best[0]:
                best = (CREDIT_RELATED, "related", rs)
    return best
