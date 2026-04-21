# AI-Powered TXT → Markdown Transformation

This document defines the implementation details for **(do stuff)** — the processing step executed when a directory contains **exactly one `.txt` file** and **no `.md` files**.

The responsibility of this step is to:

* Read the contents of the `.txt` file
* Use **AI** to transform the content into **clean, structured Markdown**
* Persist the generated `.md` file back to storage

---

## 1. Purpose of (do stuff)

The `(do stuff)` operation exists to automatically convert unstructured or semi-structured text into high-quality Markdown documentation.

Typical source `.txt` files may include:

* Meeting transcripts
* Voice-to-text dumps
* Notes or brainstorms
* Rough technical writeups

The output must be:

* Human-readable
* Well-structured
* Valid `.md` format

---

## 2. Technology Stack

### 2.1 AI Orchestration: Agno (formerly Phidata)

Agno is used as the **agent framework** responsible for:

* Prompt orchestration
* Instruction enforcement
* Structured Markdown output
* Future extensibility (memory, teams, knowledge bases)

### 2.2 Language Model Runtime: Ollama

Ollama provides a **local LLM runtime**, enabling:

* Offline / private processing
* Large-context local models
* Fast iteration and low cost

Recommended models:

```bash
ollama pull llama3.2
# or
ollama pull mistral-nemo
```

| Model          | Use Case                                     |
| -------------- | -------------------------------------------- |
| `llama3.2`     | General-purpose documentation                |
| `mistral-nemo` | Very large transcripts (up to ~128k context) |

---

## 3. Processing Flow

The `(do stuff)` step follows this sequence:

1. Load the `.txt` file contents into memory
2. Initialize an Agno Agent with Markdown-focused instructions
3. Pass the text as context to the agent
4. Receive Markdown output from the model
5. Save the result as a `.md` file in the same directory

---

## 4. Agent Design

### 4.1 Agent Responsibilities

The AI agent must:

* Clean up raw text
* Remove filler words and redundancies
* Impose logical structure
* Use Markdown semantics correctly

---

### 4.2 Agent Instructions

The agent is configured with clear, deterministic instructions:

* Read the full transcript carefully
* Remove filler words ("um", "ah", "like")
* Eliminate repetitive statements
* Organize content using:

  * `#` for top-level headings
  * `##` and `###` for sub-sections
* Use bullet lists where appropriate
* Emphasize key terms using **bold**
* Insert:

  * A **Summary** section at the top
  * An **Action Items** section at the bottom

---

## 5. Reference Implementation (Python)

```python
from agno.agent import Agent
from agno.models.ollama import Ollama

# Initialize the agent
agent = Agent(
    model=Ollama(id="llama3.2"),
    description=(
        "You are an expert technical writer who specializes in converting "
        "messy transcripts into clean, structured Markdown documentation."
    ),
    instructions=[
        "Read the provided transcript carefully.",
        "Remove all filler words (um, ah, like) and repetitive speech.",
        "Organize the content into a logical hierarchy using H1, H2, and H3 headers.",
        "Use bullet points for lists and bold text for key terms or deadlines.",
        "Add a 'Summary' section at the top and an 'Action Items' section at the bottom.",
        "Ensure the output is a valid .md file format."
    ],
    markdown=True,
)

# Load the .txt file
with open("transcript.txt", "r") as f:
    raw_text = f.read()

# Run the transformation
response = agent.run(
    f"Please convert this transcript into a Markdown document:\n\n{raw_text}"
)

# Save the output
with open("documentation.md", "w") as f:
    f.write(response.content)

print("Markdown documentation generated successfully.")
```

---

## 6. Handling Large Files & Context Limits

For very large transcripts (20–30+ minutes of speech), context limits become important.

Agno allows extending Ollama context size:

```python
Ollama(id="mistral-nemo", options={"num_ctx": 32768})
```

For extremely large files, future versions may:

* Chunk text into a KnowledgeBase
* Use vector search (e.g. LanceDB)
* Retrieve only relevant sections per agent task

---

## 7. Output Rules

The generated Markdown file must:

* Be saved alongside the source `.txt`
* Use the same base filename

  * `notes.txt` → `notes.md`
* Contain no raw transcript artifacts
* Be idempotent (running twice should produce equivalent output)

---

## 8. Future Extensions

Planned enhancements include:

* Multi-agent pipelines (summarizer, verifier, formatter)
* Company-specific style guides
* Metadata injection (timestamps, authorship)
* Automatic `.txt` archival or deletion post-processing

---

## 9. Summary

The `(do stuff)` step encapsulates all AI-driven content transformation. By isolating this logic into its own module and documentation, the system remains clean, testable, and extensible while leveraging powerful local AI through Agno and Ollama.

