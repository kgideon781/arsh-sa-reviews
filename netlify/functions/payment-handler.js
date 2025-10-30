exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        // For GET requests, return a simple page or redirect
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
        <!DOCTYPE html>
        <html>
          <head><title>REDCap Handler</title></head>
          <body>
            <h1>REDCap Payment Handler</h1>
            <p>This endpoint receives POST data from REDCap.</p>
            <p>Status: Ready</p>
          </body>
        </html>
      `
        };
    }

    // Handle POST from REDCap
    try {
        const params = new URLSearchParams(event.body);
        const data = Object.fromEntries(params);

        console.log('REDCap Data:', JSON.stringify(data, null, 2));

        // TODO: Process the data - store it, trigger actions, etc.

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Payment data received'
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};