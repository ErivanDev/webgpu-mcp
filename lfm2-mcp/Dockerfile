FROM python:3.12-alpine

RUN adduser -D -u 1000 appuser

WORKDIR /app
COPY --chown=1000:1000 dist ./dist

USER 1000
EXPOSE 7860

CMD ["python", "-m", "http.server", "7860", "--bind", "0.0.0.0", "--directory", "/app/dist"]
