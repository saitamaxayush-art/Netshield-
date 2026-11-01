"""Print the FastAPI OpenAPI schema as JSON (used by `npm run gen:api` in frontend/)."""

import json
import sys

from backend.main import app


def main() -> None:
    json.dump(app.openapi(), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
