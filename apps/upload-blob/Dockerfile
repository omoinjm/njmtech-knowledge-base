FROM python:3.11

WORKDIR /code

COPY apps/upload-blob/requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY apps/upload-blob/ /code/

CMD ["fastapi", "run", "api/main.py", "--port", "8000"]
