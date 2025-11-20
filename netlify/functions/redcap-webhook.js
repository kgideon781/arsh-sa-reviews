exports.handler = async (event, context) => {
    const API_URL = 'https://surveys.aphrc.org/redcap/api/';

    try {
        // Log the raw event to see what we're getting
        console.log("🔔 REDCap DET Trigger Received");
        console.log("Raw event.body:", event.body);
        console.log("Type of event.body:", typeof event.body);

        // Handle different body formats
        let body;
        if (typeof event.body === 'string') {
            try {
                body = JSON.parse(event.body);
            } catch (e) {
                // If it's not JSON, maybe it's form-urlencoded
                console.log("Body is not JSON, trying URLSearchParams");
                const params = new URLSearchParams(event.body);
                body = Object.fromEntries(params);
            }
        } else {
            body = event.body || {};
        }

        console.log("Parsed body:", body);

        // Example: fetch updated data from REDCap API
        const recordId = body.record || body.record_id;

        if (!recordId) {
            console.log("⚠️ No record ID found in body");
            return {
                statusCode: 200,
                body: "No record ID provided",
            };
        }

        const apiResponse = await fetch(API_URL, {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                token: '41511809027787BF40860383A25B03CE',
                content: "record",
                format: "json",
                type: "flat",
                records: recordId,

            }),
        });

        const data = await apiResponse.json();

        console.log("📌 Updated record from REDCap:", data);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, record: data }),
        };

    } catch (error) {
        console.error("❌ ERROR:", error);
        console.error("Error stack:", error.stack);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};