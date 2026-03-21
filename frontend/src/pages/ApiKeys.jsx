import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Key, Plus, Trash2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import GlassPanel from '../components/ui/GlassPanel';

export default function ApiKeys() {
    const { token } = useAuth();
    const [credentials, setCredentials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [syncingId, setSyncingId] = useState(null);

    // form state
    const [showForm, setShowForm] = useState(false);
    const [brokerName, setBrokerName] = useState('Alpaca');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [endpoint, setEndpoint] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchCredentials();
    }, [token]);

    const fetchCredentials = async () => {
        try {
            const res = await axios.get('http://localhost:8000/brokers/credentials', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCredentials(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ type: '', text: '' });

        try {
            await axios.post('http://localhost:8000/brokers/credentials', {
                broker_name: brokerName,
                api_key: apiKey,
                api_secret: apiSecret,
                endpoint: endpoint || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMessage({ type: 'success', text: `${brokerName} account linked successfully!` });
            setShowForm(false);
            setApiKey('');
            setApiSecret('');
            setEndpoint('');
            fetchCredentials();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.detail || `Failed to link ${brokerName}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this connection?")) return;

        try {
            await axios.delete(`http://localhost:8000/brokers/credentials/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCredentials();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSync = async (id) => {
        setSyncingId(id);
        setMessage({ type: '', text: '' });

        try {
            const res = await axios.post(`http://localhost:8000/brokers/credentials/${id}/sync`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to sync broker' });
        } finally {
            setSyncingId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto w-full animate-fade-in">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Integrations</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Connect your brokerages to sync your portfolio automatically.
                    </p>
                </div>
                {!showForm && (
                    <Button onClick={() => setShowForm(true)} icon={Plus} className="!w-auto !py-2 !px-4">
                        Link Broker
                    </Button>
                )}
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 text-sm font-medium ${message.type === 'success'
                    ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            {showForm && (
                <GlassPanel className="mb-8 p-6 border-l-4 border-l-primary-500">
                    <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Add New Broker Connection</h2>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Broker</label>
                            <select
                                value={brokerName}
                                onChange={(e) => setBrokerName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                            >
                                <option value="Alpaca">Alpaca Paper Trading</option>
                                <option value="Binance Demo">Binance Spot Demo</option>
                            </select>
                        </div>

                        <Input
                            label={brokerName === 'Alpaca' ? "API Key ID (APCA-API-KEY-ID)" : "API Key"}
                            type="text"
                            required
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={brokerName === 'Alpaca' ? "e.g. PKXQ9E..." : "Your Binance Testnet API Key"}
                        />
                        <Input
                            label={brokerName === 'Alpaca' ? "Secret Key (APCA-API-SECRET-KEY)" : "Secret Key"}
                            type="password"
                            required
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            placeholder={brokerName === 'Alpaca' ? "Your Alpaca Secret Key" : "Your Binance Secret Key"}
                        />
                        <Input
                            label="API Endpoint (Optional)"
                            type="text"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder={brokerName === 'Alpaca' ? "e.g. https://paper-api.alpaca.markets/v2" : "e.g. https://demo-api.binance.com"}
                        />

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={isSubmitting}>
                                Connect
                            </Button>
                        </div>
                    </form>
                </GlassPanel>
            )}

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading connections...</div>
                ) : credentials.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50">
                        <Key className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No brokers linked</h3>
                        <p className="text-gray-500 dark:text-gray-400">Securely connect your first broker to automatically import your portfolio.</p>
                    </div>
                ) : (
                    credentials.map((cred) => (
                        <GlassPanel key={cred.id} className="p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                    {cred.broker_name[0]}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">{cred.broker_name} {cred.broker_name === 'Alpaca' && '(Paper)'}</h3>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Key: {cred.api_key}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleSync(cred.id)}
                                    disabled={syncingId === cred.id}
                                    className="p-2 text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                                    title="Sync Portfolio Data"
                                >
                                    <RefreshCw className={`w-5 h-5 ${syncingId === cred.id ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    onClick={() => handleDelete(cred.id)}
                                    disabled={syncingId === cred.id}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                    title="Remove connection"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </GlassPanel>
                    ))
                )}
            </div>
        </div>
    );
}
