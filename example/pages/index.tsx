import React from 'react';
import styles from './index.css';
import { useSelector } from 'react-redux';
export default function Index() {
  const counter = useSelector(state => state.a)
  return (
    <div className={styles.normal}>
      {counter}
    </div>
  );
};

Index.getInitialProps = (async ({store}) => {
  store.dispatch({
    type:'INCREMENT'
  })
  return store.getState();
});