class CustomException(Exception):
    def __init__(
        self,
        status_code: int,
        detail: str = None,
        title: str = None,
        instance: str = None,
        type: str = None,
        additional_info: dict = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.title = title
        self.instance = instance
        self.type = type
        self.additional_info = additional_info
