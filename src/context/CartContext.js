import React, { createContext, useContext, useReducer, useEffect } from 'react';

const initialState = {
  items: [],
  orderType: 'dine_in',
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Each item has a unique cartKey = id + addon snapshot
      const key = action.payload.cartKey || String(action.payload.id);
      const existing = state.items.find((i) => i.cartKey === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.cartKey === key ? { ...i, quantity: i.quantity + action.payload.quantity } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.payload, cartKey: key }] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.cartKey !== action.payload && i.id !== action.payload) };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items
          .map((i) =>
            (i.cartKey === action.payload.id || i.id === action.payload.id)
              ? { ...i, quantity: action.payload.quantity }
              : i
          )
          .filter((i) => i.quantity > 0),
      };
    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.payload };
    case 'SET_TABLE_NUMBER':
      return { ...state, tableNumber: action.payload };
    case 'CLEAR_CART':
      return { ...initialState };
    case 'LOAD_CART':
      return action.payload;
    default:
      return state;
  }
}

const CartContext = createContext(undefined);

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem('tasteza_cart');
    if (saved) {
      try {
        dispatch({ type: 'LOAD_CART', payload: JSON.parse(saved) });
      } catch { }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tasteza_cart', JSON.stringify(state));
  }, [state]);

  const subtotal = state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gstTotal = state.items.reduce((sum, i) => {
    const gst = Number(i.gst_percent || 0);
    return sum + (i.price * i.quantity * gst) / 100;
  }, 0);
  const [settings, setSettings] = React.useState(null);

  // Load delivery config from public settings once
  React.useEffect(() => {
    fetch('/api/settings/public')
      .then(r => r.json())
      .then(d => { if (d.success) setSettings(d.data); })
      .catch(() => { });
  }, []);

  const deliveryFreeAbove = Number(settings?.delivery_free_above ?? process.env.REACT_APP_DELIVERY_FREE_ABOVE ?? 199);
  const deliveryChargeAmt = Number(settings?.delivery_charge ?? process.env.REACT_APP_DELIVERY_CHARGE ?? 30);
  const deliveryCharge =
    state.orderType === 'delivery'
      ? subtotal >= deliveryFreeAbove ? 0 : deliveryChargeAmt
      : 0;
  const grandTotal = subtotal + gstTotal + deliveryCharge;
  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        state,
        addItem: (item) => dispatch({ type: 'ADD_ITEM', payload: item }),
        removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', payload: id }),
        updateQuantity: (id, quantity) =>
          dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } }),
        setOrderType: (type) => dispatch({ type: 'SET_ORDER_TYPE', payload: type }),
        setTableNumber: (table) => dispatch({ type: 'SET_TABLE_NUMBER', payload: table }),
        clearCart: () => dispatch({ type: 'CLEAR_CART' }),
        totalItems,
        subtotal,
        gstTotal,
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
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
