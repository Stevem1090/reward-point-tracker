
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ListTodo, Check, Plus, FolderPlus, Trash2 } from 'lucide-react';

// For demonstration only - in a real app, we'd use a database
const initialLists = [
  {
    id: "1",
    title: "Grocery List",
    items: [
      { id: "1-1", text: "Milk", completed: false },
      { id: "1-2", text: "Eggs", completed: true },
      { id: "1-3", text: "Bread", completed: false },
    ]
  },
  {
    id: "2",
    title: "Homework",
    items: [
      { id: "2-1", text: "Math assignment", completed: false },
      { id: "2-2", text: "Science project", completed: false },
    ]
  }
];

const ListsPage = () => {
  const [lists, setLists] = useState(initialLists);
  const [activeListId, setActiveListId] = useState(initialLists[0].id);
  const [newItemText, setNewItemText] = useState('');
  const [newListName, setNewListName] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);

  const activeList = lists.find(list => list.id === activeListId);

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    
    setLists(lists.map(list => {
      if (list.id === activeListId) {
        return {
          ...list,
          items: [
            ...list.items,
            { id: Date.now().toString(), text: newItemText, completed: false }
          ]
        };
      }
      return list;
    }));
    
    setNewItemText('');
  };

  const handleToggleItem = (itemId: string) => {
    setLists(lists.map(list => {
      if (list.id === activeListId) {
        return {
          ...list,
          items: list.items.map(item => 
            item.id === itemId ? { ...item, completed: !item.completed } : item
          )
        };
      }
      return list;
    }));
  };

  const handleDeleteItem = (itemId: string) => {
    setLists(lists.map(list => {
      if (list.id === activeListId) {
        return {
          ...list,
          items: list.items.filter(item => item.id !== itemId)
        };
      }
      return list;
    }));
  };

  const handleAddList = () => {
    if (!newListName.trim()) return;
    
    const newList = {
      id: Date.now().toString(),
      title: newListName,
      items: []
    };
    
    setLists([...lists, newList]);
    setActiveListId(newList.id);
    setNewListName('');
    setIsAddingList(false);
  };

  const handleDeleteList = (listId: string) => {
    const newLists = lists.filter(list => list.id !== listId);
    setLists(newLists);
    
    if (listId === activeListId && newLists.length > 0) {
      setActiveListId(newLists[0].id);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-orange via-kid-yellow to-kid-green bg-clip-text text-transparent">
        Family Lists
      </h1>
      <p className="text-center mb-8 text-muted-foreground">Keep track of all your important to-dos!</p>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4">
          <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center text-kid-purple">
                  <ListTodo className="mr-2 h-5 w-5" />
                  My Lists
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsAddingList(true)}
                  className="text-kid-purple hover:text-kid-pink hover:bg-soft-pink"
                >
                  <FolderPlus className="h-5 w-5" />
                </Button>
              </div>
              <CardDescription>Select a list to view and edit</CardDescription>
            </CardHeader>
            <CardContent>
              {isAddingList ? (
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="List name"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAddList}
                    variant="outline"
                    size="sm"
                    className="text-kid-green hover:text-white hover:bg-kid-green"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              
              <div className="space-y-2">
                {lists.map(list => (
                  <div 
                    key={list.id}
                    className={`p-3 rounded-lg flex justify-between items-center cursor-pointer border ${
                      list.id === activeListId ? 'bg-soft-purple border-kid-purple' : 'bg-white hover:bg-soft-yellow'
                    }`}
                    onClick={() => setActiveListId(list.id)}
                  >
                    <div>
                      <p className="font-medium">{list.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.items.filter(item => !item.completed).length} remaining
                      </p>
                    </div>
                    {list.id === activeListId && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(list.id);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-8">
          {activeList && (
            <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-kid-purple">{activeList.title}</CardTitle>
                <CardDescription>
                  {activeList.items.filter(item => !item.completed).length} items remaining
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="Add a new item"
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  />
                  <Button onClick={handleAddItem} className="bg-kid-green hover:bg-kid-green/80">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {activeList.items.map(item => (
                    <div 
                      key={item.id}
                      className="p-3 rounded-lg bg-white shadow-sm border hover:shadow-md transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={item.completed}
                          onCheckedChange={() => handleToggleItem(item.id)}
                          className="data-[state=checked]:bg-kid-green data-[state=checked]:text-white"
                        />
                        <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                          {item.text}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteItem(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {activeList.items.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      <p>No items in this list yet.</p>
                      <p className="mt-2 text-sm">Add your first item using the form above!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListsPage;
