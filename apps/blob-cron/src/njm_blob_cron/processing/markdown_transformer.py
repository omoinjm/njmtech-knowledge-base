from njm_blob_cron.processing.base import FileProcessor
from njm_blob_cron.config import CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_API_TOKEN, CLOUDFLARE_AI_MODEL
from njm_blob_cron.blob_storage.base import BlobStorage
import httpx
import os

class MarkdownTransformer(FileProcessor):
    """
    Concrete implementation of FileProcessor that uses Cloudflare Workers AI
    to transform raw text into a structured Markdown document.
    """

    def __init__(self, blob_storage: BlobStorage):
        self.blob_storage = blob_storage
        self.account_id = CLOUDFLARE_ACCOUNT_ID
        self.api_token = CLOUDFLARE_AI_API_TOKEN
        self.model_id = CLOUDFLARE_AI_MODEL

    def _build_prompt(self, text: str) -> str:
        """Builds the prompt for the AI model."""
        instructions = [
            "Read the provided transcript carefully.",
            "Remove all filler words (um, ah, like) and repetitive speech.",
            "Organize the content into a logical hierarchy using H1, H2, and H3 headers.",
            "Use bullet points for lists and bold text for key terms or deadlines.",
            "Add a 'Summary' section at the top and an 'Action Items' section at the bottom.",
            "Ensure the output is a valid .md file format.",
            "Do not include the prompt in the response.",
            "Only return the markdown.",
        ]
        
        prompt = (
            "You are an expert technical writer who specializes in converting "
            "messy transcripts into clean, structured Markdown documentation.\n\n"
            f"{' '.join(instructions)}\n\n"
            f"Please convert this transcript into a Markdown document:\n\n{text}"
        )
        return prompt

    async def _run_ai(self, prompt: str) -> str:
        """Calls Cloudflare Workers AI's REST API and returns the model's text response."""
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model_id}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                url,
                json={"messages": [{"role": "user", "content": prompt}]},
                headers={"Authorization": f"Bearer {self.api_token}"},
            )
        data = response.json()

        if response.status_code != 200 or not data.get("success"):
            errors = data.get("errors") or []
            message = "; ".join(e.get("message", "") for e in errors) or f"HTTP {response.status_code}"
            raise RuntimeError(f"Workers AI request failed: {message}")

        return data["result"]["response"]

    async def process(self, file_content: str, source_pathname: str) -> str:
        """
        Transforms the given text content into Markdown and saves it back to blob storage.
        """
        prompt = self._build_prompt(file_content)

        print(f"Transforming '{source_pathname}' using model '{self.model_id}'...")

        try:
            markdown_content = await self._run_ai(prompt)

            # Strip markdown code blocks if the model wrapped the response
            if markdown_content.startswith("```markdown"):
                markdown_content = markdown_content.removeprefix("```markdown")
                if markdown_content.endswith("```"):
                    markdown_content = markdown_content.removesuffix("```")
            elif markdown_content.startswith("```"):
                markdown_content = markdown_content.removeprefix("```")
                if markdown_content.endswith("```"):
                    markdown_content = markdown_content.removesuffix("```")
            
            markdown_content = markdown_content.strip()
            
            # Determine the output path
            base, _ = os.path.splitext(source_pathname)
            output_pathname = f"{base}.md"
            
            print(f"Saving transformed content to '{output_pathname}'...")
            
            # Upload the new markdown file
            upload_result = await self.blob_storage.upload(
                pathname=output_pathname,
                content=markdown_content.encode('utf-8')
            )
            
            notes_url = upload_result.get('url')
            print(f"Successfully transformed and saved '{output_pathname}'. URL: {notes_url}")
            return notes_url

        except Exception as e:
            print(f"Error during AI transformation for '{source_pathname}': {e}")
            raise
