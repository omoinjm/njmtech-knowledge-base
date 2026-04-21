from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime

router = APIRouter(tags=["Demo"])


@router.get("/data", summary="Demo data")
async def demo_data():
    """Returns a collection of demo users, products, and metrics."""
    demo_content = {
        "status": "ok",
        "data": {
            "users": [
                {
                    "id": 1,
                    "name": "Alice Johnson",
                    "email": "alice@example.com",
                    "role": "admin",
                    "active": True,
                },
                {
                    "id": 2,
                    "name": "Bob Smith",
                    "email": "bob@example.com",
                    "role": "user",
                    "active": True,
                },
                {
                    "id": 3,
                    "name": "Charlie Brown",
                    "email": "charlie@example.com",
                    "role": "user",
                    "active": False,
                },
            ],
            "products": [
                {
                    "id": 101,
                    "name": "Laptop Pro",
                    "price": 1299.99,
                    "category": "Electronics",
                    "stock": 45,
                },
                {
                    "id": 102,
                    "name": "Wireless Mouse",
                    "price": 29.99,
                    "category": "Accessories",
                    "stock": 150,
                },
                {
                    "id": 103,
                    "name": "USB-C Cable",
                    "price": 12.99,
                    "category": "Accessories",
                    "stock": 200,
                },
            ],
            "metrics": {
                "total_sales": 45230.50,
                "active_users": 342,
                "orders_today": 27,
                "revenue_growth": 15.3,
            },
        },
        "timestamp": datetime.now().isoformat(),
    }

    return JSONResponse(status_code=200, content=demo_content)
