# TodoList - Phantom API

A complete TodoList application built with React, TypeScript and Phantom API. This application demonstrates the usage of the `phantom-api` package to create a dynamic interface with table relationship management.

## Features

✅ **Complete task management**
- Create, edit, delete tasks
- Mark tasks as completed
- Priority system (low, medium, high)
- Due dates with overdue alerts

✅ **Advanced tag system**
- Dynamic tag creation
- Customizable colored tags
- Multiple tag filtering
- Tag search functionality

✅ **Category management**
- Organization by categories
- Colored categories
- Category filtering

✅ **Modern user interface**
- Responsive design with Tailwind CSS
- Lucide React icons
- Smooth animations
- Intuitive interface

✅ **Filters and search**
- Filter by status (in progress, completed)
- Filter by priority
- Text search
- Combinable filters

## Architecture

### Project structure

```
src/
├── components/          # React components
│   ├── TodoForm.tsx    # Creation form
│   ├── TodoList.tsx    # Task list
│   ├── TodoItem.tsx    # Individual item
│   └── FilterBar.tsx   # Filter bar
├── services/           # API services
│   ├── api.ts         # API configuration
│   ├── todoService.ts # Task service
│   └── tagService.ts  # Tag/category service
├── hooks/             # Custom hooks
│   └── useTodos.ts    # Main hook
├── types/             # TypeScript types
│   └── index.ts       # Interfaces and types
└── App.tsx            # Main component
```

### Phantom API usage

The project uses Phantom API v1.0.5 `resource()` pattern:

```typescript
// Resource configuration
const TodoResource = resource('Todo');
const TagResource = resource('Tag');
const CategoryResource = resource('Category');

// Safe creation
const response = await TodoResource.safeCreate(data);

// Safe update
const response = await TodoResource.safeUpdate(id, data);

// Retrieval with relations
const response = await TodoResource.read({
  include: {
    tags: true,
    category: true
  }
});
```

## Installation and startup

1. **Install dependencies**
```bash
npm install
```

2. **Configure the API**
Make sure your Phantom API backend is running on `http://localhost:3000`

3. **Start the development server**
```bash
npm run dev
```

4. **Access the application**
Open `http://localhost:5176` in your browser

## Configuration

### Phantom API Backend

Make sure you have a Phantom API backend running with:
- Port 3000 (default)
- CORS enabled for `http://localhost:5176`
- Dynamic tables enabled

### Environment variables

Create a `.env` file if needed:
```
VITE_API_URL=http://localhost:3000
VITE_API_KEY=your-api-key-here
```

## Data models

### Todo
```typescript
interface Todo {
  id?: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  categoryId?: string;
  tagIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}
```

### Tag
```typescript
interface Tag {
  id?: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### Category
```typescript
interface Category {
  id?: string;
  name: string;
  color: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

## Technical features

### Relationship management
- Many-to-Many relationships between Todos and Tags
- One-to-Many relationships between Categories and Todos
- Automatic relationship loading

### State management
- Custom `useTodos` hook
- Local state with useState
- Centralized error handling

### Advanced filtering
- Combinable filters
- Text search
- Automatic sorting by priority and date

### Responsive interface
- Mobile-first design
- Adaptive components
- Consistent icons

## Available scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Build preview
- `npm run lint` - Code linting

## Technologies used

- **React 18** - UI framework
- **TypeScript** - Static typing
- **Vite** - Build tool
- **Tailwind CSS** - CSS framework
- **Lucide React** - Icons
- **phantom-api** - Dynamic API

## Customization

### Adding new fields
1. Extend interfaces in `src/types/index.ts`
2. Modify services in `src/services/`
3. Update components

### Modifying colors
Colors are defined in `src/App.css` with Tailwind CSS.

### Adding new features
Follow the existing architecture:
1. Create service in `src/services/`
2. Add types in `src/types/`
3. Create components in `src/components/`
4. Integrate in `src/App.tsx`

## Deployment

### Production build
```bash
npm run build
```

### Static server
```bash
npm run preview
```

Build files will be in the `dist/` folder.

## Support

For questions or issues:
1. Check that the Phantom API backend is working
2. Check browser logs
3. Verify CORS configuration
4. Consult Phantom API documentation

## License

MIT - See LICENSE file for more details.