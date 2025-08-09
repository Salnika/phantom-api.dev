import { apiService, ApiService } from "@/services/api";
import { useEffect, useState } from "react";

interface UseApiServiceReturn {
    tables: string[];
    loading: boolean;
    error: string | null;
    apiService: ApiService;
    getSystemUsers: ApiService['getSystemUsers'];
    getSystemRoles: ApiService['getSystemRoles'];
    createSystemUser: ApiService['createSystemUser'];
    updateSystemUser: ApiService['updateSystemUser'];
    deleteSystemUser: ApiService['deleteSystemUser'];
}

export const useApiService = (): UseApiServiceReturn => {
    const [tables, setTables] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const loadTables = async () => {
            setLoading(true);
            try {
                const tablesData = await apiService.getTables();
                setTables(tablesData.data || []);
            } catch (error) {
                setError('Failed to load tables:' + JSON.stringify(error));
                setTables([]);
            } finally {
                setLoading(false);
            }
        };
        loadTables();
    }, [])
    return {
        tables,
        loading,
        error,
        apiService,
        getSystemUsers: apiService.getSystemUsers.bind(apiService),
        getSystemRoles: apiService.getSystemRoles.bind(apiService),
        createSystemUser: apiService.createSystemUser.bind(apiService),
        updateSystemUser: apiService.updateSystemUser.bind(apiService),
        deleteSystemUser: apiService.deleteSystemUser.bind(apiService),
    }
}
