import './App.css';
import ProposalsReviewDashboard from "./proposals-review-dashboard";
import {Routes, Route, Navigate} from "react-router-dom";
import MarkingSheetBackup from "./MarkingSheet";
import {useState} from "react";
import SelfServiceReviewQueue from "./SelfServiceReviewQueue";

// Passcode-protected dashboard wrapper
function ProtectedDashboard() {
    const [passcode, setPasscode] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState('');

    const CORRECT_PASSCODE = 'ARSH2025'; // Change this to your desired passcode

    const handleSubmit = (e) => {
        e.preventDefault();
        if (passcode === CORRECT_PASSCODE) {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('Invalid passcode. Please try again.');
            setPasscode('');
        }
    };

    if (isAuthenticated) {
        return <ProposalsReviewDashboard />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Secretariat Access</h2>
                    <p className="text-gray-600 mt-2">Enter passcode to view dashboard</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <input
                            type="password"
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            placeholder="Enter passcode"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent text-center text-lg tracking-widest"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Access Dashboard
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>This area is restricted to authorized personnel only.</p>
                </div>
            </div>
        </div>
    );
}

function App() {
    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<ProtectedDashboard />} />
                <Route path="/reviews" element={<MarkingSheetBackup />} />
                <Route path="/my-reviews" element={<SelfServiceReviewQueue />} />
                <Route path="*" element={<Navigate to="/reviews" replace />} />
            </Routes>
        </div>
    );
}

export default App;