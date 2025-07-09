FROM postgres:15-alpine

# Set environment variables
ENV POSTGRES_DB=motohours_db
ENV POSTGRES_USER=motohours_user
ENV POSTGRES_PASSWORD=motohours_password

# Copy initialization scripts
COPY init.sql /docker-entrypoint-initdb.d/

# Expose port
EXPOSE 5432 