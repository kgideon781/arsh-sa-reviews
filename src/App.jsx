import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ProposalsReviewDashboard from './Home.jsx'
import MarkingSheet from './MarkingSheet'
import RecordsDashboard from "./Polling.jsx";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<ProposalsReviewDashboard />} />
                <Route path="/reviews" element={<MarkingSheet />} />
                <Route path={"/records"} element={<RecordsDashboard/>} />
            </Routes>
        </Router>
    )
}

export default App