import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ProposalsReviewDashboard from './Home'
import MarkingSheet from './MarkingSheet'

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<ProposalsReviewDashboard />} />
                <Route path="/reviews" element={<MarkingSheet />} />
            </Routes>
        </Router>
    )
}

export default App