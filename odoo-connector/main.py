from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"service":"odoo-connector"}

@app.post("/sync/order")
def sync_order(order: dict):
    print("Received Shopify order:", order["id"])
    return {"status":"ok"}