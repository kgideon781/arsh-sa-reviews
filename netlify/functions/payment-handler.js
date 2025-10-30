exports.handler = async (event, context) => {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Parse the form data from REDCap
        const params = new URLSearchParams(event.body);
        const data = Object.fromEntries(params);

        // Log the received data
        console.log('REDCap Data Received:', JSON.stringify(data, null, 2));

        // Here you can process the data as needed
        // For example, store it, send notifications, etc.

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Data received successfully',
                receivedFields: Object.keys(data)
            })
        };
    } catch (error) {
        console.error('Error processing REDCap data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};