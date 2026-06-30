import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { specificationsApi } from '@/services/specifications-api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Settings2, ExternalLink, MoreVertical, CopyPlus, Archive, Trash2, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function SpecificationsPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState('newest');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['specifications'],
        queryFn: () => specificationsApi.getSpecifications(token!),
        enabled: !!token
    });

    const handleDuplicate = async (id: string) => {
        try {
            const res = await specificationsApi.duplicateSpecification(id, token!);
            toast.success('Pomyślnie zduplikowano specyfikację');
            refetch();
            if (res?.specification?.id) {
                navigate(`/admin/specifications/${res.specification.id}/edit`);
            }
        } catch (error: any) {
            toast.error(error.message || 'Błąd podczas duplikowania');
        }
    };

    const handleArchiveToggle = async (id: string, isArchived: boolean) => {
        try {
            await specificationsApi.archiveSpecification(id, isArchived, token!);
            toast.success(isArchived ? 'Zarchiwizowano specyfikację' : 'Przywrócono specyfikację');
            refetch();
        } catch (error: any) {
            toast.error('Błąd podczas zmiany statusu archiwum');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Czy na pewno chcesz usunąć tę specyfikację?')) return;
        try {
            await specificationsApi.deleteSpecification(id, token!);
            toast.success('Pomyślnie usunięto specyfikację');
            refetch();
        } catch (error: any) {
            toast.error('Błąd podczas usuwania. Być może jest powiązana z ogłoszeniami.');
        }
    };

    const specifications = data?.specifications || [];

    const filteredSpecifications = React.useMemo(() => {
        let result = specifications;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter((spec: any) => 
                spec.brand?.toLowerCase().includes(query) ||
                spec.model?.toLowerCase().includes(query) ||
                spec.version?.toLowerCase().includes(query)
            );
        }

        if (sortBy === 'brand_asc') {
            result = [...result].sort((a: any, b: any) => (a.brand || '').localeCompare(b.brand || '') || (a.model || '').localeCompare(b.model || ''));
        } else if (sortBy === 'brand_desc') {
            result = [...result].sort((a: any, b: any) => (b.brand || '').localeCompare(a.brand || '') || (b.model || '').localeCompare(a.model || ''));
        } else if (sortBy === 'newest') {
            result = [...result].sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }

        return result;
    }, [specifications, searchQuery, sortBy]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

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

            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Szukaj po marce, modelu lub wersji..."
                        className="pl-10 h-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[200px] h-10">
                            <SelectValue placeholder="Sortuj" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Najnowsze</SelectItem>
                            <SelectItem value="brand_asc">Marka i model (A-Z)</SelectItem>
                            <SelectItem value="brand_desc">Marka i model (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-blue-500" />
                            Baza specyfikacji ({filteredSpecifications.length})
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
                            {filteredSpecifications.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        Brak specyfikacji spełniających kryteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSpecifications.map((spec: any) => (
                                    <TableRow key={spec.id} className={`hover:bg-slate-50/50 transition-colors ${spec.isArchived ? 'opacity-60 bg-gray-50' : ''}`}>
                                        <TableCell>
                                            <div className="font-medium text-slate-900">
                                                {spec.brand} {spec.model}
                                                {spec.isArchived && <Badge variant="secondary" className="ml-2 text-[10px]">Archiwalna</Badge>}
                                            </div>
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
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100 rounded-full">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => handleDuplicate(spec.id)}>
                                                        <CopyPlus className="w-4 h-4 mr-2 text-slate-500" />
                                                        <span>Duplikuj</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link to={`/admin/specifications/${spec.id}/edit`} className="flex items-center">
                                                            <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                                            <span>Edytuj</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {spec.isArchived ? (
                                                        <DropdownMenuItem onClick={() => handleArchiveToggle(spec.id, false)} className="text-green-600 focus:text-green-600">
                                                            <Archive className="w-4 h-4 mr-2" />
                                                            <span>Przywróć</span>
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => handleArchiveToggle(spec.id, true)} className="text-orange-600 focus:text-orange-600">
                                                            <Archive className="w-4 h-4 mr-2" />
                                                            <span>Archiwizuj</span>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        onClick={() => handleDelete(spec.id)} 
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        <span>Usuń definitywnie</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
