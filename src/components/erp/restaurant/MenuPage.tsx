'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChefHat,
  Leaf,
  Clock,
  ToggleLeft,
  ToggleRight,
  Package,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Types
interface MenuCategory {
  id: string
  name: string
  description: string | null
  active: boolean
  sortOrder: number
  itemCount: number
}

interface MenuItem {
  id: string
  categoryId: string
  name: string
  description: string | null
  price: number
  image: string | null
  available: boolean
  isVeg: boolean
  preparationTime: number | null
  category: { id: string; name: string }
}

interface CategoryFormData {
  name: string
  description: string
  active: boolean
  sortOrder: number
}

interface ItemFormData {
  categoryId: string
  name: string
  description: string
  price: number
  isVeg: boolean
  available: boolean
  preparationTime: number | null
}

const defaultItemForm: ItemFormData = {
  categoryId: '',
  name: '',
  description: '',
  price: 0,
  isVeg: true,
  available: true,
  preparationTime: null,
}

const defaultCategoryForm: CategoryFormData = {
  name: '',
  description: '',
  active: true,
  sortOrder: 0,
}

export default function MenuPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(defaultCategoryForm)
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<MenuCategory | null>(null)

  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm)

  // Fetch categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: () => api.get<{ success: boolean; data: MenuCategory[] }>('/menu-categories'),
  })
  const categories = categoriesData?.data || []

  // Fetch menu items
  const { data: menuItemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items-admin', filterCategory],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' })
      if (filterCategory !== 'all') params.set('categoryId', filterCategory)
      return api.get<{ success: boolean; data: MenuItem[] }>(
        `/menu-items?${params.toString()}`
      )
    },
  })
  const menuItems = menuItemsData?.data || []

  // Filter and sort
  const filteredItems = menuItems
    .filter((item) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'price') return a.price - b.price
      return 0
    })

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormData) => api.post('/menu-categories', data),
    onSuccess: () => {
      toast.success('Category created')
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      setCategoryDialogOpen(false)
      setCategoryForm(defaultCategoryForm)
    },
    onError: (error: Error) => toast.error('Failed to create category', { description: error.message }),
  })

  const updateCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormData & { id: string }) => api.put('/menu-categories', data),
    onSuccess: () => {
      toast.success('Category updated')
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      setCategoryDialogOpen(false)
      setEditingCategory(null)
      setCategoryForm(defaultCategoryForm)
    },
    onError: (error: Error) => toast.error('Failed to update category', { description: error.message }),
  })

  // Item mutations
  const createItemMutation = useMutation({
    mutationFn: (data: ItemFormData) => api.post('/menu-items', data),
    onSuccess: () => {
      toast.success('Menu item created')
      queryClient.invalidateQueries({ queryKey: ['menu-items-admin'] })
      setItemDialogOpen(false)
      setItemForm(defaultItemForm)
    },
    onError: (error: Error) => toast.error('Failed to create item', { description: error.message }),
  })

  const updateItemMutation = useMutation({
    mutationFn: (data: ItemFormData & { id: string }) => api.put(`/menu-items/${data.id}`, data),
    onSuccess: () => {
      toast.success('Menu item updated')
      queryClient.invalidateQueries({ queryKey: ['menu-items-admin'] })
      setItemDialogOpen(false)
      setEditingItem(null)
      setItemForm(defaultItemForm)
    },
    onError: (error: Error) => toast.error('Failed to update item', { description: error.message }),
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      api.put(`/menu-items/${id}`, { available }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-admin'] })
    },
    onError: (error: Error) => toast.error('Failed to toggle availability', { description: error.message }),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menu-items/${id}`),
    onSuccess: (_, id) => {
      toast.success('Menu item deleted')
      queryClient.invalidateQueries({ queryKey: ['menu-items-admin'] })
    },
    onError: (error: Error) => toast.error('Failed to delete item', { description: error.message }),
  })

  // Handlers
  const handleEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat)
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      active: cat.active,
      sortOrder: cat.sortOrder,
    })
    setCategoryDialogOpen(true)
  }

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required')
      return
    }
    if (editingCategory) {
      updateCategoryMutation.mutate({ ...categoryForm, id: editingCategory.id })
    } else {
      createCategoryMutation.mutate(categoryForm)
    }
  }

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item)
    setItemForm({
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || '',
      price: item.price,
      isVeg: item.isVeg,
      available: item.available,
      preparationTime: item.preparationTime,
    })
    setItemDialogOpen(true)
  }

  const handleSaveItem = () => {
    if (!itemForm.name.trim()) {
      toast.error('Item name is required')
      return
    }
    if (!itemForm.categoryId) {
      toast.error('Please select a category')
      return
    }
    if (itemForm.price <= 0) {
      toast.error('Price must be greater than 0')
      return
    }
    if (editingItem) {
      updateItemMutation.mutate({ ...itemForm, id: editingItem.id })
    } else {
      createItemMutation.mutate(itemForm)
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Menu Management</h1>
              <p className="text-xs text-slate-400">CloudView Restaurant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setEditingCategory(null)
                setCategoryForm(defaultCategoryForm)
                setCategoryDialogOpen(true)
              }}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <Plus className="w-4 h-4 mr-1" />
              Category
            </Button>
            <Button
              onClick={() => {
                setEditingItem(null)
                setItemForm(defaultItemForm)
                setItemDialogOpen(true)
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Menu Item
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  Categories ({categories.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : categories.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No categories yet
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                          filterCategory === cat.id
                            ? 'bg-amber-100 text-amber-800'
                            : 'hover:bg-slate-100'
                        }`}
                        onClick={() =>
                          setFilterCategory(filterCategory === cat.id ? 'all' : cat.id)
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${cat.active ? 'bg-green-500' : 'bg-slate-300'}`} />
                          <span className="truncate">{cat.name}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
                            {cat.itemCount}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-1 text-slate-400 hover:text-amber-600"
                            onClick={() => handleEditCategory(cat)}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Items Section */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">
                    Menu Items ({filteredItems.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 w-48 text-xs"
                      />
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Sort: Name</SelectItem>
                        <SelectItem value="price">Sort: Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {itemsLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Prep Time</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                            No menu items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <span
                                className={`w-3 h-3 rounded-full block ${
                                  item.isVeg ? 'bg-green-500' : 'bg-red-500'
                                }`}
                                title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium text-sm">{item.name}</span>
                                {item.description && (
                                  <p className="text-xs text-slate-400 truncate max-w-[200px]">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.category.name}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-amber-700">
                              ৳{item.price.toFixed(0)}
                            </TableCell>
                            <TableCell>
                              {item.preparationTime ? (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {item.preparationTime}m
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={item.available}
                                onCheckedChange={(checked) =>
                                  toggleAvailabilityMutation.mutate({
                                    id: item.id,
                                    available: checked,
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-400 hover:text-red-600"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="Category name"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, description: e.target.value })
                }
                placeholder="Optional description"
                className="h-16 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={categoryForm.active}
                onCheckedChange={(checked) =>
                  setCategoryForm({ ...categoryForm, active: checked })
                }
              />
              <Label className="text-xs">Active</Label>
            </div>
            <div>
              <Label className="text-xs">Sort Order</Label>
              <Input
                type="number"
                value={categoryForm.sortOrder}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    sortOrder: Number(e.target.value),
                  })
                }
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="Item name"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select
                value={itemForm.categoryId}
                onValueChange={(val) => setItemForm({ ...itemForm, categoryId: val })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Price *</Label>
              <Input
                type="number"
                min={0}
                value={itemForm.price || ''}
                onChange={(e) =>
                  setItemForm({ ...itemForm, price: Number(e.target.value) || 0 })
                }
                placeholder="0"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm({ ...itemForm, description: e.target.value })
                }
                placeholder="Optional description"
                className="h-16 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={itemForm.isVeg}
                  onCheckedChange={(checked) =>
                    setItemForm({ ...itemForm, isVeg: checked })
                  }
                />
                <Label className="text-xs flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${itemForm.isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
                  {itemForm.isVeg ? 'Veg' : 'Non-Veg'}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={itemForm.available}
                  onCheckedChange={(checked) =>
                    setItemForm({ ...itemForm, available: checked })
                  }
                />
                <Label className="text-xs">Available</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Preparation Time (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={itemForm.preparationTime ?? ''}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    preparationTime: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Optional"
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={createItemMutation.isPending || updateItemMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
