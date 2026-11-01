"""Error types and the shared error body (API_CONTRACT.md section 5). No FastAPI imports."""

from pydantic import BaseModel, ConfigDict

# Details are either one object of scalars and id lists, or a list of {path, message} entries.
DetailValue = str | int | list[str]
ErrorDetails = dict[str, DetailValue] | list[dict[str, str]]


class ErrorInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: ErrorDetails | None = None


class ErrorResponse(BaseModel):
    """Body of every non 2xx response: {"error": {"code", "message", "details"?}}."""

    model_config = ConfigDict(extra="forbid")

    error: ErrorInfo


class ApiError(Exception):
    """An error with a contract code. Raised from validation or handlers, rendered by the app."""

    def __init__(self, code: str, message: str, details: ErrorDetails | None = None, status_code: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
        self.status_code = status_code

    def body(self) -> dict[str, object]:
        error: dict[str, object] = {"code": self.code, "message": self.message}
        if self.details is not None:
            error["details"] = self.details
        return {"error": error}


class GraphValidationError(ApiError):
    """A request that is well formed JSON but violates a graph rule or limit (HTTP 422).

    Raised from Pydantic model validators. Pydantic only converts ValueError and AssertionError into
    validation errors; this class deliberately is neither, so it propagates unchanged and keeps its
    specific contract code (DUPLICATE_NODE_ID, PARALLEL_EDGE, LIMIT_EXCEEDED, ...).
    """
