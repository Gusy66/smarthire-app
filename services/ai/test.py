from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Test service running"}

@app.get("/")
async def root():
    return {"message": "Hello World"}
