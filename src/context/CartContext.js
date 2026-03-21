import React, { createContext, useContext, useReducer, useEffect } from 'react';

const initialState = {
  items: [],
  orderType: 'dine_in',
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.payload.id
              ? { ...i, quantity: i.quantity + action.payload.quantity }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items
          .map((i) =>
            i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
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
  const deliveryFreeAbove = Number(process.env.REACT_APP_DELIVERY_FREE_ABOVE || 199);
  const deliveryChargeAmt = Number(process.env.REACT_APP_DELIVERY_CHARGE || 30);
  const deliveryCharge =
    state.orderType === 'delivery'
      ? subtotal >= deliveryFreeAbove ? 0 : deliveryChargeAmt
      : 0;
  const grandTotal = subtotal + deliveryCharge;
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
