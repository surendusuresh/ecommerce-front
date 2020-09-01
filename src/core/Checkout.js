import React, { useEffect, useState } from 'react'
import { isAuthenticated } from '../auth/index'
import { getBraintreeClientToken, processPayment, createOrder } from './apiCore'
import { emptyCart } from './cartHelpers'
import { Link } from 'react-router-dom'
import DropIn from 'braintree-web-drop-in-react'

const Checkout = ({ products, setRun = f => f }) => {

    const [data, setData] = useState({
        success: false,
        clientToken: null,
        error: '',
        instance: {},
        address: '',
        loading: false
    })

    const userId = isAuthenticated() && isAuthenticated().user._id
    const token = isAuthenticated() && isAuthenticated().token

    const getToken = (userId, token) => {
        getBraintreeClientToken(userId, token).then(data => {
            if (data.error) {
                setData({ ...data, error: data.error })
            }
            else {
                setData({ clientToken: data.clientToken })
            }
        })
    }

    useEffect(() => {
        getToken(userId, token)
    }, [])

    const getTotal = () => {
        return products.reduce((currentValue, nextValue) => {
            return currentValue + nextValue.count * nextValue.price
        }, 0)
    }

    let deliveryAddress = data.address

    const showCheckout = () => (
        isAuthenticated() ? (
            <div>{showDropIn()}</div>
        ) : (
                <Link to="/signin">
                    <button className="btn btn-primary">Sign in to checkout</button>
                </Link>
            )
    )

    const handleAddress = (event) => {
        setData({ ...data, address: event.target.value })
    }

    const buy = () => {
        setData({ ...data, loading: true })
        //send nonce to the server 
        // nonce = data.instance.requestPaymentMethod()

        let nonce;
        let getNonce = data.instance.requestPaymentMethod()
            .then(data => {
                //console.log(data)
                nonce = data.nonce
                // once you have nonce (card type, card number) send nonce as 'paymentMethodNonce' 
                // and also total to be charged
                //console.log('send nonce and toal to process: ', nonce, getTotal(products))
                const paymentData = {
                    paymentMethodNonce: nonce,
                    amount: getTotal(products)
                }
                processPayment(userId, token, paymentData)
                    .then(response => {

                        const createOrderData = {
                            products: products,
                            transaction_id: response.transaction.id,
                            amount: response.transaction.amount,
                            address: deliveryAddress
                        }
                        // create order
                        createOrder(userId, token, createOrderData)
                            .then(() => {
                                //Empty cart
                                
                                emptyCart(() => {
                                    setRun(true)
                                    setData({ ...data, loading: false, success: true })
                                    console.log('payment success and cart emptied')
                                })
                            })
                            .catch(error => {
                                console.log(error)
                                setData({ loading: false })
                            })

                    })
                    .catch(error => {
                        setData({ ...data, loading: false })
                        console.log(error)
                    })
            })
            .catch(err => {
                //console.log('drop in error: ', err)
                setData({ ...data, error: err.message })
            })
    }

    const showLoading = (loading) => (
        loading && <h2>Loading...</h2>
    )
    const showError = err => (
        <div className="alert alert-danger" style={{ display: err ? '' : 'none' }}>
            {err}
        </div>
    )

    const showSuccess = success => (
        <div className="alert alert-info" style={{ display: success ? '' : 'none' }}>
            Thanks! Your payment was successful.
        </div>
    )

    const showDropIn = () => (
        <div onBlur={() => setData({ ...data, error: '' })}>
            {data.clientToken !== null && products.length > 0 ? (
                <div>
                    <div className="gorm-group mb-3">
                        <label className="text-muted">Delivery Address</label>
                        <textarea
                            onChange={handleAddress}
                            className="form-control"
                            value={data.address}
                            placeholder="Enter your delivery address"
                        />
                    </div>
                    <DropIn options={{
                        authorization: data.clientToken,
                        paypal: {
                            flow: 'vault'
                        }
                    }} onInstance={instance => (data.instance = instance)} />
                    <button onClick={buy} className="btn btn-success btn-block">Make Payment</button>
                </div>
            ) : null}
        </div>
    )

    return (
        <div>
            <h2>Total: ${getTotal()}</h2>
            {showLoading(data.loading)}
            {showSuccess(data.success)}
            {showError(data.error)}
            {showCheckout()}

        </div>
    )
}

export default Checkout