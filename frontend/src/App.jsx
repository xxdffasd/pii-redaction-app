import { useState } from 'react';
import { checkTaskStatus, processFileRedaction, processRedaction } from './services/api';

function App() {
  const [mode, setMode] = useState('text'); // 'text' or 'file'
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [entities, setEntities] = useState('PERSON, EMAIL_ADDRESS, PHONE_NUMBER, LOCATION');
  const [maskChar, setMaskChar] = useState('*');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

try {
      const entityArray = entities.split(',').map((e) => e.trim()).filter(Boolean);
      let data;

        if (mode === 'text') {
        const payload = {
          text: text,
          language: 'en',
          entities: entityArray.length > 0 ? entityArray : null,
          mask_char: maskChar
        };
        const res = await processRedaction(payload);
        data = { isBatch: false, ...res }; // Flag as single text
        } else {
        if (files.length === 0) throw new Error("Please select a file to upload.");
        
        // 1. Send files to FastAPI and get the task_id
        const initialResponse = await processFileRedaction(files, entityArray, maskChar);
        const taskId = initialResponse.task_id;
        
        // 2. Start polling the background queue
        let isProcessing = true;
        while (isProcessing) {
          // Wait 2 seconds before asking again so we don't spam the server
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await checkTaskStatus(taskId);
          
          if (statusResponse.status === 'SUCCESS') {
            // Celery is done! Grab the results and break the loop
            data = {
              isBatch: true,
              results: statusResponse.result.batch_results,
              zipUrl: statusResponse.result.zip_download_url
            };
            isProcessing = false;
          } else if (statusResponse.status === 'FAILURE') {
            // Something broke inside the Celery worker
            throw new Error(statusResponse.error || "Background processing failed.");
          }
          // If status is 'PENDING' or 'STARTED', the loop just continues...
        }
      }

      setResult(data);
      } catch (err) {
      const errorDetail = err.response?.data?.detail;
      // If FastAPI sends an array of validation errors, extract the first message
      if (Array.isArray(errorDetail)) {
        setError(errorDetail[0].msg);
      } else {
        // Otherwise, show the standard string error
        setError(errorDetail || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-blue-400">PII Redaction Engine</h1>
          <p className="text-gray-400 mt-2">Enterprise-grade text anonymization powered by FastAPI and Microsoft Presidio.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Form Component */}
          <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
            {/* Mode Switcher */}
            <div className="flex space-x-2 mb-4 bg-gray-800 p-1 rounded-lg">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === 'text' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                onClick={() => setMode('text')}
              >
                Raw Text
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${mode === 'file' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                onClick={() => setMode('file')}
              >
                File Upload
              </button>
            </div>

            {/* Dynamic Input Area */}
            {mode === 'text' ? (
              <div>
                <label className="block text-sm font-medium mb-2">Input Text</label>
                <textarea
                  rows="4"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text containing sensitive data..."
                  required={mode === 'text'}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Upload Document (.txt, .pdf, .docx, .json)</label>
                <input
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx,.json"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-900 file:text-blue-300 hover:file:bg-blue-800 cursor-pointer focus:outline-none focus:border-blue-500"
                  onChange={(e) => setFiles(e.target.files)}
                  required={mode === 'file'}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Entities (Comma-separated)</label>
              <input
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500"
                value={entities}
                onChange={(e) => setEntities(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mask Character</label>
              <input
                type="text"
                maxLength="1"
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-center focus:outline-none focus:border-blue-500"
                value={maskChar}
                onChange={(e) => setMaskChar(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 transition font-medium py-3 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing...' : 'Redact Text'}
            </button>

            {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
          </form>

{/* Results Display Component */}
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-blue-300">Redaction Results</h2>
                
                {/* GLOBAL ZIP DOWNLOAD BUTTON */}
                {result?.isBatch && result.zipUrl && (
                  <a 
                    href={result.zipUrl} 
                    download
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded shadow flex items-center transition"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download All (.zip)
                  </a>
                )}
              </div>

              {result ? (
                result.isBatch ? (
                  // BATCH FILE SUMMARY UI
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {result.results.map((fileRes, idx) => (
                      // BATCH FILE SUMMARY UI
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {result.results.map((fileRes, idx) => {
                      
                      // 1. Group and calculate aggregates for this specific file
                      const aggregated = fileRes.entities_detected.reduce((acc, curr) => {
                        if (!acc[curr.entity_type]) {
                          acc[curr.entity_type] = { count: 0, totalScore: 0 };
                        }
                        acc[curr.entity_type].count += 1;
                        acc[curr.entity_type].totalScore += curr.score;
                        return acc;
                      }, {});

                      // 2. Convert the grouped object back into a sorted array
                      const summary = Object.keys(aggregated).map(type => ({
                        type,
                        count: aggregated[type].count,
                        avgScore: (aggregated[type].totalScore / aggregated[type].count) * 100
                      })).sort((a, b) => b.count - a.count); // Sort by highest count

                      return (
                        <div key={idx} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-mono text-blue-300 font-semibold">{fileRes.filename}</span>
                            <a href={fileRes.download_url} download className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1 px-3 rounded flex items-center transition">
                              Download
                            </a>
                          </div>
                          
                          <div className="flex space-x-4 mb-3 pb-3 border-b border-gray-700">
                            <span className="text-xs text-gray-400">Total Entities Mapped: <strong className="text-white">{fileRes.total_entities_found}</strong></span>
                          </div>
                          
                          {/* File-wise Entity Breakdown (Aggregated) */}
                          <div className="space-y-2">
                            {summary.map((item, i) => (
                              <div key={i} className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded-md text-xs border border-gray-700">
                                <div className="flex items-center space-x-3">
                                  <span className="font-bold text-blue-400 uppercase">{item.type}</span>
                                  <span className="text-gray-300 font-mono bg-gray-800 px-2 py-0.5 rounded-full text-[10px] border border-gray-600">
                                    x{item.count}
                                  </span>
                                </div>
                                <span className="text-gray-400 font-medium">Avg Score: {item.avgScore.toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                    ))}
                  </div>
                ) : (
                  // SINGLE TEXT UI
                  <div className="space-y-5">
                    <div>
                      <span className="text-xs uppercase text-gray-500 font-bold">Redacted Output</span>
                      <p className="bg-gray-800 p-3 rounded-lg mt-1 text-sm font-mono border border-gray-700 leading-relaxed whitespace-pre-wrap">
                        {result.redacted_text}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <span className="text-xs text-gray-400 block">Entities Found</span>
                        <span className="text-xl font-bold text-blue-400">{result.total_entities_found}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs uppercase text-gray-500 font-bold block mb-2">Detected Entities</span>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {result.entities_detected.map((item, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-800/60 border border-gray-700 px-3 py-2 rounded-lg text-xs">
                            <span className="font-semibold text-blue-400">{item.entity_type}</span>
                            <span className="text-gray-300 font-mono">"{item.text}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-gray-500 text-center py-12">
                  Submit text or upload files to see the processed output.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;