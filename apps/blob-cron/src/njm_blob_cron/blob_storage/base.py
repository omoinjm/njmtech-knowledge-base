from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BlobStorage(ABC):
    """
    Abstract base class defining the interface for a blob storage service.
    This promotes the Dependency Inversion Principle, allowing high-level
    modules to depend on this abstraction rather than concrete implementations.
    """

    @abstractmethod
    async def list(self, folder: str) -> List[Dict[str, Any]]:
        """
        Lists all files/blobs in a specified folder.

        Args:
            folder: The path of the folder to list.

        Returns:
            A list of dictionaries, where each dictionary represents a blob's metadata.
        """
        pass

    @abstractmethod
    async def download(self, pathname: str, url: str = None) -> bytes:
        """
        Downloads the content of a blob.

        Args:
            pathname: The full path to the blob.
            url: The optional direct download URL for the blob.

        Returns:
            The content of the blob as bytes.
        """
        pass

    @abstractmethod
    async def upload(self, pathname: str, content: bytes) -> Dict[str, Any]:
        """
        Uploads content to a blob.

        Args:
            pathname: The full path where the blob will be saved.
            content: The content to upload as bytes.

        Returns:
            A dictionary representing the metadata of the uploaded blob.
        """
        pass

    @abstractmethod
    async def delete(self, pathname: str) -> bool:
        """
        Deletes a blob.

        Args:
            pathname: The full path to the blob.

        Returns:
            True if deletion was successful, False otherwise.
        """
        pass
