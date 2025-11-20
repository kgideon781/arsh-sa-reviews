import { useState, useEffect } from 'react';

export default function RecordsDashboard() {
    const [records, setRecords] = useState([]);

    useEffect(() => {
        const fetchRecords = async () => {
            const res = await fetch('/.netlify/functions/get-records');
            const data = await res.json();
            setRecords(data);
        };

        fetchRecords(); // initial fetch
        const interval = setInterval(fetchRecords, 3000); // every 3 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h1>Latest REDCap Records (Test)</h1>
            <pre>{JSON.stringify(records, null, 2)}</pre>
        </div>
    );
}
