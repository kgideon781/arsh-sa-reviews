import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Search, Users, FileText, CheckCircle, AlertCircle, RefreshCw, Filter } from 'lucide-react';

const ProposalsReviewDashboard = () => {
    const [allData, setAllData] = useState([]);
    const [groupedData, setGroupedData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState('all');
    const [selectedRecommendation, setSelectedRecommendation] = useState('all');
    const [reviewCountFilter, setReviewCountFilter] = useState('all');
    const [improvementModal, setImprovementModal] = useState({ open: false, candidate: '', reviewer: '', text: '' });

    const API_URL = 'https://surveys.aphrc.org/redcap/api/';
    const API_TOKEN = '61D8A52BF9C6221AE9201EB9272C82A1';

    // HTML parsing function
    const parseHTML = (html) => {
        if (!html) return '';

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Get text content (strips HTML tags)
        let text = temp.textContent || temp.innerText || '';

        // Clean up common HTML entities
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            // Clean up excessive whitespace
            .replace(/\s+/g, ' ')
            .trim();

        return text;
    };

    // Open improvement modal
    const openImprovementModal = (candidate, reviewer, htmlText) => {
        const parsedText = parseHTML(htmlText);
        setImprovementModal({
            open: true,
            candidate,
            reviewer,
            text: parsedText || 'No comments provided'
        });
    };

    // Close improvement modal
    const closeImprovementModal = () => {
        setImprovementModal({ open: false, candidate: '', reviewer: '', text: '' });
    };

    // Smart name matching functions
    const normalizeNameForMatching = (name) => {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const findMatchingCandidate = (candidateName, existingCandidates) => {
        if (!candidateName) return null;

        const normalized = normalizeNameForMatching(candidateName);
        const words = normalized.split(' ');

        for (let existing of existingCandidates) {
            if (normalizeNameForMatching(existing) === normalized) {
                return existing;
            }
        }

        if (words.length >= 2) {
            for (let existing of existingCandidates) {
                const existingWords = normalizeNameForMatching(existing).split(' ');
                let matchCount = 0;

                for (let word of words) {
                    if (existingWords.some(ew => ew === word || ew.includes(word) || word.includes(ew))) {
                        matchCount++;
                    }
                }

                if (matchCount >= 2 || matchCount >= Math.ceil(Math.min(words.length, existingWords.length) * 0.6)) {
                    return existing;
                }
            }
        }

        return candidateName;
    };

    // Fetch data from REDCap
    const fetchData = async () => {
        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('token', API_TOKEN);
            formData.append('content', 'record');
            formData.append('format', 'json');
            formData.append('type', 'flat');
            formData.append('rawOrLabel', 'raw');
            formData.append('rawOrLabelHeaders', 'raw');
            formData.append('exportCheckboxLabel', 'false');
            formData.append('exportSurveyFields', 'false');
            formData.append('exportDataAccessGroups', 'false');
            formData.append('returnFormat', 'json');

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            const filteredData = data.filter(record => {
                const hasReviewData = (
                    (record.reviewer_name && record.reviewer_name !== '') &&
                    (record.candidate_names && record.candidate_names !== '') &&
                    (record.final_recommendation1 && record.final_recommendation1 !== '') &&
                    (record.bg_problem_clarity && record.bg_problem_clarity !== '') &&
                    (record.format_total && record.format_total !== '')
                );
                return hasReviewData;
            });

            if (filteredData.length === 0) {
                setError('No complete and valid reviews found.');
                setLoading(false);
                return;
            }

            setAllData(filteredData);
            processData(filteredData);

        } catch (err) {
            setError(`Error fetching data: ${err.message}`);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Process and group data by candidate
    const processData = (data) => {
        const grouped = {};
        const candidateMap = new Map();

        data.forEach(record => {
            let candidateName = record.candidate_names || 'Unknown Candidate';

            const existingCandidates = Array.from(candidateMap.keys());
            const matchedCandidate = findMatchingCandidate(candidateName, existingCandidates);

            if (matchedCandidate && matchedCandidate !== candidateName) {
                candidateName = candidateMap.get(matchedCandidate);
            } else {
                candidateMap.set(candidateName, candidateName);
            }

            if (!grouped[candidateName]) {
                grouped[candidateName] = [];
            }

            grouped[candidateName].push({
                originalEntry: record.candidate_names,
                reviewerName: record.reviewer_name || 'Unknown Reviewer',
                reviewerEmail: record.reviewer_email || '',
                reviewDate: record.review_date || '',
                problemClarity: parseFloat(record.bg_problem_clarity) || 0,
                justification: parseFloat(record.bg_justification) || 0,
                literature: parseFloat(record.bg_literature) || 0,
                rationale: parseFloat(record.bg_rationale) || 0,
                diversity: parseFloat(record.diversity) || 0,
                collab: parseFloat(record.collab) || 0,
                applicantCV: parseFloat(record.applicant_cv) || 0,
                proposalStrength: parseFloat(record.strength_of_the_proposal1) || 0,
                areasForImprovement: record.areas_for_improvement1 || '',
                finalRecommendation: record.final_recommendation1 || '',
                totalScore: parseFloat(record.format_total) || 0
            });
        });

        setGroupedData(grouped);
    };

    // Calculate statistics
    const stats = useMemo(() => {
        const allReviews = Object.values(groupedData).flat();

        const total = Object.keys(groupedData).length;
        const totalReviews = allReviews.length;

        const recommendations = allReviews.reduce((acc, r) => {
            if (r.finalRecommendation === '1') acc.strong++;
            else if (r.finalRecommendation === '2') acc.regular++;
            else if (r.finalRecommendation === '3') acc.notRecommend++;
            return acc;
        }, { strong: 0, regular: 0, notRecommend: 0 });

        const avgScore = allReviews.length > 0
            ? (allReviews.reduce((sum, r) => sum + r.totalScore, 0) / allReviews.length).toFixed(1)
            : 0;

        const multipleReviewers = Object.values(groupedData).filter(reviews => reviews.length > 1).length;

        return { total, totalReviews, ...recommendations, avgScore, multipleReviewers };
    }, [groupedData]);

    // Filter data
    const filteredData = useMemo(() => {
        let filtered = { ...groupedData };

        if (selectedCandidate !== 'all') {
            filtered = { [selectedCandidate]: groupedData[selectedCandidate] };
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const newFiltered = {};
            Object.keys(filtered).forEach(candidate => {
                const candidateMatch = candidate.toLowerCase().includes(search);
                const reviewerMatch = filtered[candidate].some(r =>
                    r.reviewerName.toLowerCase().includes(search)
                );
                if (candidateMatch || reviewerMatch) {
                    newFiltered[candidate] = filtered[candidate];
                }
            });
            filtered = newFiltered;
        }

        if (selectedRecommendation !== 'all') {
            const newFiltered = {};
            Object.keys(filtered).forEach(candidate => {
                const hasRec = filtered[candidate].some(r => {
                    if (selectedRecommendation === 'strong' && r.finalRecommendation === '1') return true;
                    if (selectedRecommendation === 'regular' && r.finalRecommendation === '2') return true;
                    if (selectedRecommendation === 'not' && r.finalRecommendation === '3') return true;
                    return false;
                });
                if (hasRec) newFiltered[candidate] = filtered[candidate];
            });
            filtered = newFiltered;
        }

        if (reviewCountFilter !== 'all') {
            const newFiltered = {};
            Object.keys(filtered).forEach(candidate => {
                const count = filtered[candidate].length;
                if (reviewCountFilter === 'multiple' && count > 1) {
                    newFiltered[candidate] = filtered[candidate];
                } else if (reviewCountFilter === 'single' && count === 1) {
                    newFiltered[candidate] = filtered[candidate];
                }
            });
            filtered = newFiltered;
        }

        return filtered;
    }, [groupedData, selectedCandidate, searchTerm, selectedRecommendation, reviewCountFilter]);

    // Chart data
    const scoreDistribution = useMemo(() => {
        const allReviews = Object.values(filteredData).flat();
        const ranges = { '0-7': 0, '8-14': 0, '15-18': 0, '19-21': 0 };

        allReviews.forEach(r => {
            if (r.totalScore <= 7) ranges['0-7']++;
            else if (r.totalScore <= 14) ranges['8-14']++;
            else if (r.totalScore <= 18) ranges['15-18']++;
            else ranges['19-21']++;
        });

        return Object.entries(ranges).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    const recommendationData = useMemo(() => {
        const allReviews = Object.values(filteredData).flat();
        const counts = allReviews.reduce((acc, r) => {
            if (r.finalRecommendation === '1') acc['Strongly Recommend'] = (acc['Strongly Recommend'] || 0) + 1;
            else if (r.finalRecommendation === '2') acc['Recommend'] = (acc['Recommend'] || 0) + 1;
            else if (r.finalRecommendation === '3') acc['Do Not Recommend'] = (acc['Do Not Recommend'] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

    // Export to Excel
    const exportToExcel = async () => {
        try {
            const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');

            const exportData = [];

            Object.keys(groupedData).sort().forEach(candidate => {
                groupedData[candidate].forEach((review, index) => {
                    const researchTotal = review.problemClarity + review.justification +
                        review.literature + review.rationale + review.diversity + review.collab;

                    const recText = review.finalRecommendation === '1' ? 'Strongly Recommend' :
                        review.finalRecommendation === '2' ? 'Recommend' :
                            review.finalRecommendation === '3' ? 'Do Not Recommend' : 'Not Specified';

                    // Parse HTML for Excel export
                    const parsedImprovement = parseHTML(review.areasForImprovement) || 'None specified';

                    exportData.push({
                        'Candidate Name': candidate,
                        'Reviewer #': index + 1,
                        'Reviewer Name': review.reviewerName,
                        'Reviewer Email': review.reviewerEmail,
                        'Review Date': review.reviewDate,
                        'Innovation & Originality': review.problemClarity,
                        'Relevance': review.justification,
                        'Feasibility': review.literature,
                        'Applicant Potential': review.rationale,
                        'Diversity & Inclusion': review.diversity,
                        'Collaboration': review.collab,
                        'Applicant CV': review.applicantCV,
                        'Proposal Strength': review.proposalStrength,
                        'Research Subtotal': researchTotal.toFixed(1),
                        'Total Score': review.totalScore,
                        'Final Recommendation': recText,
                        'Areas for Improvement': parsedImprovement
                    });
                });
            });

            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            ws['!cols'] = [
                { wch: 30 }, // Candidate Name
                { wch: 10 }, // Reviewer #
                { wch: 25 }, // Reviewer Name
                { wch: 30 }, // Reviewer Email
                { wch: 15 }, // Review Date
                { wch: 12 }, // Innovation
                { wch: 12 }, // Relevance
                { wch: 12 }, // Feasibility
                { wch: 12 }, // Applicant Potential
                { wch: 12 }, // Diversity
                { wch: 12 }, // Collaboration
                { wch: 12 }, // Applicant CV
                { wch: 12 }, // Proposal Strength
                { wch: 12 }, // Research Subtotal
                { wch: 12 }, // Total Score
                { wch: 20 }, // Final Recommendation
                { wch: 60 }  // Areas for Improvement
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'reviewer_assignments');

            XLSX.writeFile(wb, `ARSH_Fellows_Reviews_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting data. Please try again.');
        }
    };

    const getRecommendationBadge = (rec) => {
        if (rec === '1') return { text: 'Strongly Recommend', class: 'bg-emerald-100 text-emerald-800' };
        if (rec === '2') return { text: 'Recommend', class: 'bg-blue-100 text-blue-800' };
        if (rec === '3') return { text: 'Do Not Recommend', class: 'bg-red-100 text-red-800' };
        return { text: 'Not Specified', class: 'bg-gray-100 text-gray-800' };
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent">
                                ARSH Fellows Proposal Reviews
                            </h1>
                            <p className="text-gray-600 mt-2">Comprehensive Review Dashboard - PID: 112</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Fetching...' : 'Fetch Reviews'}
                            </button>
                            {Object.keys(groupedData).length > 0 && (
                                <button
                                    onClick={exportToExcel}
                                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg"
                                >
                                    <Download className="w-5 h-5" />
                                    Export to Excel
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-xl">
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {/* Stats Cards */}
                {Object.keys(groupedData).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Total Candidates</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
                                </div>
                                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-7 h-7 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Total Reviews</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.totalReviews}</p>
                                </div>
                                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                                    <FileText className="w-7 h-7 text-green-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Strongly Recommended</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.strong}</p>
                                </div>
                                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium mb-1">Avg Score</p>
                                    <p className="text-4xl font-bold text-gray-900">{stats.avgScore}<span className="text-xl text-gray-500">/21</span></p>
                                </div>
                                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                                    <AlertCircle className="w-7 h-7 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Charts */}
                {Object.keys(groupedData).length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Score Distribution</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={scoreDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '14px' }} />
                                    <YAxis stroke="#6b7280" style={{ fontSize: '14px' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recommendations Breakdown</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={recommendationData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {recommendationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Filters */}
                {Object.keys(groupedData).length > 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-gray-600" />
                            <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="relative">
                                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search candidates or reviewers..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>

                            <select
                                value={selectedCandidate}
                                onChange={(e) => setSelectedCandidate(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="all">All Candidates</option>
                                {Object.keys(groupedData).sort().map(c => (
                                    <option key={c} value={c}>{c} ({groupedData[c].length})</option>
                                ))}
                            </select>

                            <select
                                value={selectedRecommendation}
                                onChange={(e) => setSelectedRecommendation(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="all">All Recommendations</option>
                                <option value="strong">Strongly Recommend</option>
                                <option value="regular">Recommend</option>
                                <option value="not">Do Not Recommend</option>
                            </select>

                            <select
                                value={reviewCountFilter}
                                onChange={(e) => setReviewCountFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                <option value="all">All Review Counts</option>
                                <option value="multiple">Multiple Reviewers</option>
                                <option value="single">Single Reviewer</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Reviews Table */}
                {Object.keys(filteredData).length > 0 && (
                    <div className="space-y-6">
                        {Object.keys(filteredData).sort().map(candidate => {
                            const reviews = filteredData[candidate];
                            const recCounts = reviews.reduce((acc, r) => {
                                if (r.finalRecommendation === '1') acc.strong++;
                                else if (r.finalRecommendation === '2') acc.regular++;
                                else if (r.finalRecommendation === '3') acc.not++;
                                return acc;
                            }, { strong: 0, regular: 0, not: 0 });

                            return (
                                <div key={candidate} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4">
                                        <h3 className="text-2xl font-bold text-white mb-2">{candidate}</h3>
                                        <div className="flex gap-4 flex-wrap">
                      <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        📊 {reviews.length} Review{reviews.length > 1 ? 's' : ''}
                      </span>
                                            <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        ✅ Strong: {recCounts.strong}
                      </span>
                                            <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        👍 Regular: {recCounts.regular}
                      </span>
                                            <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                        ❌ Not: {recCounts.not}
                      </span>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b-2 border-emerald-200">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Reviewer</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Scores</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Total</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Recommendation</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Improvements</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                            {reviews.map((review, idx) => {
                                                const badge = getRecommendationBadge(review.finalRecommendation);
                                                return (
                                                    <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full font-semibold text-sm">
                                  {idx + 1}
                                </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-gray-900">{review.reviewerName}</div>
                                                            <div className="text-sm text-gray-500">{review.reviewerEmail}</div>
                                                            {review.originalEntry !== candidate && (
                                                                <div className="text-xs text-amber-600 mt-1">
                                                                    Originally entered as: {review.originalEntry}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{review.reviewDate || 'N/A'}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                                <div className="bg-blue-50 p-2 rounded">
                                                                    <div className="font-medium text-blue-900">Innovation: {review.problemClarity}</div>
                                                                    <div className="text-blue-700">Relevance: {review.justification}</div>
                                                                    <div className="text-blue-700">Feasibility: {review.literature}</div>
                                                                </div>
                                                                <div className="bg-purple-50 p-2 rounded">
                                                                    <div className="font-medium text-purple-900">Potential: {review.rationale}</div>
                                                                    <div className="text-purple-700">Collaboration: {review.collab}</div>
                                                                    <div className="text-purple-700">CV Quality: {review.applicantCV}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-3xl font-bold text-emerald-600">{review.totalScore}</div>
                                                            <div className="text-xs text-gray-500">out of 21</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${badge.class}`}>
                                  {badge.text}
                                </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button
                                                                onClick={() => openImprovementModal(candidate, review.reviewerName, review.areasForImprovement)}
                                                                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm underline decoration-dotted hover:decoration-solid transition-all"
                                                            >
                                                                View Comments
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Improvement Modal */}
                {improvementModal.open && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={closeImprovementModal}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Areas for Improvement</h3>
                                        <p className="text-emerald-100 mt-1">{improvementModal.candidate}</p>
                                    </div>
                                    <button
                                        onClick={closeImprovementModal}
                                        className="text-white hover:text-emerald-100 transition-colors"
                                    >
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-emerald-50 text-sm mt-2">
                                    Reviewer: <span className="font-medium">{improvementModal.reviewer}</span>
                                </p>
                            </div>

                            <div className="px-6 py-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                                <div className="prose prose-emerald max-w-none">
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                                        {improvementModal.text}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
                                <button
                                    onClick={closeImprovementModal}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && Object.keys(groupedData).length === 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Yet</h3>
                        <p className="text-gray-600 mb-6">Click "Fetch Reviews" to load data from REDCap</p>
                    </div>
                )}

                {/* No Results After Filter */}
                {!loading && Object.keys(groupedData).length > 0 && Object.keys(filteredData).length === 0 && (
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-10 h-10 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h3>
                        <p className="text-gray-600 mb-6">Try adjusting your filters</p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCandidate('all');
                                setSelectedRecommendation('all');
                                setReviewCountFilter('all');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ProposalsReviewDashboard;