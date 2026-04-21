from abc import ABC, abstractmethod

class FileProcessor(ABC):
    """
    Abstract base class for a file processor. This follows the Open/Closed
    Principle, allowing for new types of file processors to be added without
    modifying the core scanning logic.
    """

    @abstractmethod
    async def process(self, file_content: str, source_pathname: str) -> str:
        """
        Processes the given file content.

        Args:
            file_content: The content of the file to process.
            source_pathname: The original path of the source file, which can
                             be used to determine the output path.
        
        Returns:
            The URL of the processed file, or None if not applicable.
        """
        pass
