import React, { createContext, useContext, useReducer, useEffect } from "react";

export type OrderType = "dine_in" | "takeaway" | "delivery";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  variants?: { name: string; price: number };
  notes?: string;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  tableNumber?: string;
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "SET_ORDER_TYPE"; payload: OrderType }
  | { type: "SET_TABLE_NUMBER"; payload: string }
  | { type: "CLEAR_CART" }
  | { type: "LOAD_CART"; payload: CartState };

const initialState: CartState = {
  items: [],
  orderType: "dine_in",
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) => (i.id === action.payload.id ? { ...i, quantity: i.quantity + action.payload.quantity } : i)),
        };
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case "UPDATE_QUANTITY":
      return {
        ...state,
        items: state.items
          .map((i) => (i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i))
          .filter((i) => i.quantity > 0),
      };
    case "SET_ORDER_TYPE":
      return { ...state, orderType: action.payload };
    case "SET_TABLE_NUMBER":
      return { ...state, tableNumber: action.payload };
    case "CLEAR_CART":
      return { ...initialState };
    case "LOAD_CART":
      return action.payload;
    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (table: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  deliveryCharge: number;
  grandTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem("tasteza_cart");
    if (saved) {
      try {
        dispatch({ type: "LOAD_CART", payload: JSON.parse(saved) });
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tasteza_cart", JSON.stringify(state));
  }, [state]);

  const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryCharge =
    state.orderType === "delivery"
      ? subtotal >= Number(import.meta.env.VITE_DELIVERY_FREE_ABOVE || 199)
        ? 0
        : Number(import.meta.env.VITE_DELIVERY_CHARGE || 30)
      : 0;
  const grandTotal = subtotal + deliveryCharge;
  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        state,
        addItem: (item) => dispatch({ type: "ADD_ITEM", payload: item }),
        removeItem: (id) => dispatch({ type: "REMOVE_ITEM", payload: id }),
        updateQuantity: (id, quantity) => dispatch({ type: "UPDATE_QUANTITY", payload: { id, quantity } }),
        setOrderType: (type) => dispatch({ type: "SET_ORDER_TYPE", payload: type }),
        setTableNumber: (table) => dispatch({ type: "SET_TABLE_NUMBER", payload: table }),
        clearCart: () => dispatch({ type: "CLEAR_CART" }),
        totalItems,
        subtotal,
        deliveryCharge,
        grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
