import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { specificationsApi } from '@/services/specifications-api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Settings2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function SpecificationsPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = React.useState(false);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['specifications'],
        queryFn: () => specificationsApi.getSpecifications(token!),
        enabled: !!token
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const specifications = data?.specifications || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Specyfikacje Pojazdów</h1>
                    <p className="text-muted-foreground mt-1">Zarządzaj modelami, rocznikami i wyposażeniem</p>
                </div>
                <Button 
                    onClick={async () => {
                        setIsCreating(true);
                        try {
                            const res = await specificationsApi.createSpecification(token!);
                            navigate(`/admin/specifications/${res.specification.id}/edit`);
                        } catch(e) {
                            toast.error('Nie udało się utworzyć nowej specyfikacji.');
                        } finally {
                            setIsCreating(false);
                        }
                    }}
                    disabled={isCreating}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Dodaj specyfikację
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-blue-500" />
                            Baza specyfikacji ({specifications.length})
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Odśwież
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead>Marka i Model</TableHead>
                                <TableHead>Wersja</TableHead>
                                <TableHead>Silnik</TableHead>
                                <TableHead>W magazynie</TableHead>
                                <TableHead>Tryb Wyświetlania</TableHead>
                                <TableHead className="text-right">Akcje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {specifications.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Brak specyfikacji w bazie. Pojawią się one automatycznie po imporcie z plików zewnętrznych.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                specifications.map((spec: any) => (
                                    <TableRow key={spec.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell>
                                            <div className="font-medium text-slate-900">{spec.brand} {spec.model}</div>
                                            <div className="text-xs text-slate-500">{spec.manufacturingYear} • {spec.bodyType}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-600">{spec.version}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">{spec.engineCapacityCm3} cm³ / {spec.enginePowerHp} KM</div>
                                            <div className="text-xs text-slate-500">{spec.fuelType} • {spec.transmission}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={spec.stockCount > 0 ? "default" : "secondary"}>
                                                {spec.stockCount} szt.
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={spec.displayMode === 'GROUPED' ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                                                {spec.displayMode}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link to={`/admin/specifications/${spec.id}/edit`}>
                                                    Edytuj <ExternalLink className="w-4 h-4 ml-2" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
