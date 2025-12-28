import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { importApi } from '@/services/api';
import { toast } from 'sonner';

interface UploadResult {
    totalRows: number;
    inserted: number;
    updated: number;
    archived: number;
    priceChanges: number;
    duration: number;
    importLogId: string;
}

export function CSVUploader() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const { token } = useAuth();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !token) return;

        setIsUploading(true);
        try {
            const uploadResult = await importApi.uploadCSV(file, token);
            setResult(uploadResult);
            toast.success(`Import successful! ${uploadResult.inserted} inserted, ${uploadResult.updated} updated`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload CSV File
                </CardTitle>
                <CardDescription>
                    Upload a tab-separated CSV file with vehicle listings
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* File Input */}
                <div className="flex items-center gap-4">
                    <label
                        htmlFor="csv-upload"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                        <FileText className="w-6 h-6 text-gray-400" />
                        <span className="text-sm text-gray-600">
                            {file ? file.name : 'Click to select CSV file'}
                        </span>
                        <input
                            id="csv-upload"
                            type="file"
                            accept=".csv,.tsv"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isUploading}
                        />
                    </label>
                </div>

                {/* Upload Button */}
                {file && (
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="w-full"
                    >
                        {isUploading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload and Process
                            </>
                        )}
                    </Button>
                )}

                {/* Upload Progress */}
                {isUploading && (
                    <div className="space-y-2">
                        <Progress value={50} className="w-full" />
                        <p className="text-sm text-gray-600 text-center">
                            Processing CSV file...
                        </p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-green-900">Import Successful</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-600">Total rows:</span>
                                        <span className="ml-2 font-semibold">{result.totalRows}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Inserted:</span>
                                        <span className="ml-2 font-semibold text-green-600">{result.inserted}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Updated:</span>
                                        <span className="ml-2 font-semibold text-blue-600">{result.updated}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Archived:</span>
                                        <span className="ml-2 font-semibold text-orange-600">{result.archived}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Price changes:</span>
                                        <span className="ml-2 font-semibold">{result.priceChanges}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Duration:</span>
                                        <span className="ml-2 font-semibold">{(result.duration / 1000).toFixed(2)}s</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold">CSV Format:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>Tab-separated values (TSV)</li>
                            <li>First row must contain column headers</li>
                            <li>Required fields: make, model, price_pln, production_year, mileage_km</li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
