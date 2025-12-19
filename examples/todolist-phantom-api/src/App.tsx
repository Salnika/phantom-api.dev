import { CheckSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { TodoForm } from './components/TodoForm';
import { TodoList } from './components/TodoList';
import { FilterBar } from './components/FilterBar';
import { useTodos } from './hooks/useTodos';

function App() {
  const {
    todos,
    tags,
    categories,
    loading,
    error,
    filter,
    searchQuery,
    selectedCategoryId,
    selectedTagIds,
    todoCounts,
    createTodo,
    toggleTodo,
    deleteTodo,
    loadData,
    clearError,
    setFilter,
    setSearchQuery,
    setSelectedCategoryId,
    setSelectedTagIds
  } = useTodos();

  const handleCreateTodo = async (data: any) => {
    await createTodo(data);
  };

  const handleToggleTodo = async (id: string) => {
    await toggleTodo(id);
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
  };

  const handleRetry = () => {
    clearError();
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <CheckSquare className="w-8 h-8 text-blue-500 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">
              TodoList - Phantom API
            </h1>
          </div>
          <p className="text-gray-600">
            Manage your tasks with tags, categories and relations
          </p>
        </header>

        {/* Erreur globale */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </button>
          </div>
        )}

        {/* Formulaire de création */}
        <TodoForm
          onSubmit={handleCreateTodo}
          isLoading={loading}
        />

        {/* Barre de filtres */}
        <FilterBar
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          selectedTagIds={selectedTagIds}
          onTagsChange={setSelectedTagIds}
          tags={tags}
          categories={categories}
          todoCounts={todoCounts}
        />

        {/* Liste des tâches */}
        <TodoList
          todos={todos}
          onToggle={handleToggleTodo}
          onDelete={handleDeleteTodo}
          isLoading={loading}
        />

        {/* Footer */}
        <footer className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            Built with{' '}
            <a
              href="https://github.com/salnikoff/phantom-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600"
            >
              Phantom API
            </a>
            {' '}and React
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;