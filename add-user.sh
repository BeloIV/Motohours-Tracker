#!/bin/bash

# Add User Script for Motohours Tracker
# This script adds users with automatic password hashing

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 john mypassword123"
    echo ""
    echo "This script will automatically hash the password and add the user to the database."
    exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "🔄 Adding user: $USERNAME"
echo "🔐 Password will be automatically hashed"

# Execute the Node.js script inside the backend container
sudo docker-compose exec backend node scripts/add-user-with-hash.js "$USERNAME" "$PASSWORD"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ User added successfully!"
    echo "You can now login at https://regulus.bytboyzserver.xyz"
else
    echo ""
    echo "❌ Failed to add user. Please check the error messages above."
fi 
#!/bin/bash

# Add User via API Script for Motohours Tracker
# This script sends a registration request using curl

if [ $# -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 john mypassword123"
    echo ""
    echo "This script will send a registration request to the backend API."
    exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "🔄 Registering user: $USERNAME"
echo "🔐 Sending credentials to API..."

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://regulusbackend.bytboyzserver.xyz/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

if [ "$RESPONSE" -eq 201 ]; then
    echo ""
    echo "✅ User registered successfully!"
    echo "You can now login at https://regulus.bytboyzserver.xyz"
else
    echo ""
    echo "❌ Failed to register user. HTTP status: $RESPONSE"
fi