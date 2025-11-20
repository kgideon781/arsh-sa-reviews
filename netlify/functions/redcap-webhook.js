exports.handler = async (event, context) => {
    const API_URL = 'https://surveys.aphrc.org/redcap/api/'
    try {
        const body = event.body ? JSON.parse(event.body) : {};

        console.log("🔔 REDCap DET Trigger Received");
        console.log(body);

        // Example: fetch updated data from REDCap API
        const recordId = body.record;

        const apiResponse = await fetch(API_URL, {
            method: "POST",
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
            body: "OK",
        };

    } catch (error) {
        console.error("❌ ERROR:", error);

        return {
            statusCode: 500,
            body: "Internal Server Error",
        };
    }
};
