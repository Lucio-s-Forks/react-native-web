/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

import getBoundingClientRect from '../../modules/getBoundingClientRect';
import setValueForStyles from '../../modules/setValueForStyles';

const getRect = (node) => {
  // Unlike the DOM's getBoundingClientRect, React Native layout measurements
  // for "height" and "width" ignore scale transforms.
  // https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Determining_the_dimensions_of_elements
  const { x, y, top, left } = getBoundingClientRect(node);
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  return { x, y, width, height, top, left };
};

function arraysEqual(a1, a2) {
  /* WARNING: arrays must not contain {objects} or behavior may be undefined */
  return JSON.stringify(a1) === JSON.stringify(a2);
}

function prependMatrix(m1, m2) {
  // matrix multiplication
  const a1 = m1[0];
  const c1 = m1[2];
  const tx1 = m1[4];

  m1[0] = m2[0] * a1 + m2[2] * m1[1];
  m1[1] = m2[1] * a1 + m2[3] * m1[1];
  m1[2] = m2[0] * c1 + m2[2] * m1[3];
  m1[3] = m2[1] * c1 + m2[3] * m1[3];
  m1[4] = m2[0] * tx1 + m2[2] * m1[5] + m2[4];
  m1[5] = m2[1] * tx1 + m2[3] * m1[5] + m2[5];
}

function getCombinedMatrix(element) {
  // TODO: optimize
  const matrixInfo = { elementsWithTransform: [] };
  const { matrix, originCoord } = getMatrixOfElement(element);
  matrixInfo.combinedMatrix = [...matrix];
  if (originCoord.element) {
    matrixInfo.elementsWithTransform.push({ ...originCoord });
  }
  let node = element.parentNode;

  while (node && node instanceof Element) {
    // traverse dom tree
    const { matrix: node_matrix, originCoord } = getMatrixOfElement(node);
    prependMatrix(matrixInfo.combinedMatrix, node_matrix); // prepend matrix of parent node
    if (originCoord.element) {
      matrixInfo.elementsWithTransform.push({ ...originCoord });
    }
    node = node.parentNode;
  }

  return matrixInfo;
}

function getMatrixOfElement(element) {
  // TODO: optimize
  const matrix = [1, 0, 0, 1, 0, 0]; // default matrix (no transforms)
  const raw_transform = window.getComputedStyle(element).transform;

  const originCoord = {};
  if (raw_transform && raw_transform !== 'none') {
    //   console.log('Raw transform', raw_transform, 'of', element);
    // remove string wrapper 'matrix(' and split into parts
    const parts = raw_transform.slice(7, -1).split(',');
    for (let i = 0; i < parts.length; i++) {
      matrix[i] = parseFloat(parts[i]); // put string parts into matrix as float
    }
    // TODO: check if stringyfy is the best way to compare arrays.
    if (arraysEqual(matrix, [1, 0, 0, 1, 0, 0])) {
      return { matrix, originCoord };
    }
    const originTransform = window.getComputedStyle(element).transformOrigin;
    // console.log('originTransform', originTransform);
    originCoord.originY = parseFloat(
      originTransform.slice(originTransform.indexOf(' ') + 1)
    );
    originCoord.originX = parseFloat(originTransform);
    originCoord.element = element;
    // console.log('Parsed transform matrix', matrix, 'of', element);
    originCoord.matrix = matrix;
    // console.log('TRANSFORM ORIGIN in elemnt with transform', originTransform);
  }

  return { matrix, originCoord };
}

function getElTransformOriginRelativeViewport(node) {
  const elRect = node.getBoundingClientRect();

  return {
    nodeCenterX: elRect.left + elRect.width / 2,
    nodeCenterY: elRect.top + elRect.height / 2
  };
}

function getElCenterRelativeViewport(node) {
  const elRect = node.getBoundingClientRect();

  return {
    nodeCenterX: elRect.left + elRect.width / 2,
    nodeCenterY: elRect.top + elRect.height / 2
    // nodeCenterX: elRect.left + Math.round(elRect.width) / 2,
    // nodeCenterY:  elRect.top + Math.round(elRect.height) / 2,
    // nodeCenterX: elRect.left + Math.ceil(elRect.width) / 2,
    // nodeCenterY:  elRect.top + Math.ceil(elRect.height) / 2,
  };
}

function revertCoord(matrix, x, y) {
  const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];

  const revertedX =
    (x * matrix[3] -
      y * matrix[2] +
      matrix[2] * matrix[5] -
      matrix[4] * matrix[3]) /
    det;
  const revertedY =
    (-x * matrix[1] +
      y * matrix[0] +
      matrix[4] * matrix[1] -
      matrix[0] * matrix[5]) /
    det;

  return {
    revertedX,
    revertedY
  };
}

function convertCoord({ combinedMatrix: matrix, elementsWithTransform }, node) {
  // TODO: optimize
  //add sanity checks and default values

  if (matrix.length === 6 && elementsWithTransform.length) {
    elementsWithTransform.reverse();
    // STEP 1: Get the center of the element

    console.log('About to convert offset of', node);
    // const rect = getBoundingClientRect(node);
    // const bottom = rect.bottom;
    // const right = rect.right;
    // const top = rect.top;
    // const left = rect.left;
    // console.log('node Y', y);
    // console.log('node X', x);
    // const originCoord = elementsWithTransform[0];
    // if(matrix[3] < 0) {
    //   y = rect.bottom;
    // //   console.log('node bottom', y);
    // }

    // if(matrix[0] < 0) {
    //   x = rect.right
    // }

    //  VERSION 2
    //   //2D matrix
    //   //need some math to apply inverse of matrix
    // var t = matrix,
    // det = t[0]*t[3] - t[1]*t[2];
    // // console.log('Node X to origin After Inverse' , (  xToOrigin*t[3] - yToOrigin*t[2] + t[2]*t[5] - t[4]*t[3] )/det)
    // // console.log('Node Y to origin After Inverse' , ( -xToOrigin*t[1] + yToOrigin*t[0] + t[4]*t[1] - t[0]*t[5] )/det)

    // let yElCentralPoint = top + (bottom - top)/2;
    // console.log('Y offset', top, '(bottom - y)/2', (bottom - top)/2, 'Y offset Central Point', yElCentralPoint, );
    // let xElCentralPoint = left + (right - left)/2;
    // console.log('X offset', left, '(right - x)/2', (right - left)/2, 'X offset Central Point', xElCentralPoint, );

    // let yElCentralPoint = y
    // let xElCentralPoint = x
    // console.log('Elements With Transform Before Iteration', elementsWithTransform);
    // let convertedTop = top;
    // let convertedLeft = left;
    // let convertedBottom = bottom;
    // let convertedRight = right;

    let { nodeCenterX, nodeCenterY } = getElCenterRelativeViewport(node);

    console.log(elementsWithTransform[0]);
    const originsReverted = [];
    // let {
    //   nodeCenterX : transformerCenterX,
    //   nodeCenterY: transformerCenterY,
    // } = getElTransformOriginRelativeViewport(elementsWithTransform[0].element);

    // originsReverted.push({transformerCenterX, transformerCenterY})

    // for(let i = elementsWithTransform.length - 1; i >= 0; i--) {
    for (let i = 0; i < elementsWithTransform.length; i++) {
      // const t = matrix,
      console.log(
        'Start iteration',
        i,
        'nodeCenterX',
        nodeCenterX,
        'nodeCenterY',
        nodeCenterY
      );

      const elTransformer = elementsWithTransform[i];
      // const matrix = elementsWithTransform[i].matrix;
      // console.log('matrix', t, 'Element', elementsWithTransform[i].element);
      // const det = t[0]*t[3] - t[1]*t[2];

      // const ancestorRect = ancestor.element.getBoundingClientRect();
      // const ancestorHalfWidth_Transformed =  (ancestorRect.right - ancestorRect.left)/2;
      // const ancestorHalfHeight_Transformed =  (ancestorRect.bottom - ancestorRect.top)/2;

      // // transform origin ignore tranformations of its own element and parents, but if we want the transform origin relative to viewport
      // // we must get the true distance of transform origin relative to the Top of its own Tranforemd element
      // const ancestorOriginX_Transformed = ancestorHalfWidth_Transformed - (ancestorHalfWidth_Transformed/Math.abs(ancestor.matrix[0]) - ancestor.originX) * ancestor.matrix[0];
      // const ancestorOriginY_Transformed = ancestorHalfHeight_Transformed - (ancestorHalfHeight_Transformed/Math.abs(ancestor.matrix[3]) - ancestor.originY) * ancestor.matrix[3];

      // const ancestorOriginY_RelativeViewport = ancestorRect.top + ancestorOriginY_Transformed;
      // const ancestorOriginX_RelativeViewport = ancestorRect.left + ancestorOriginX_Transformed;

      // STEP 2: Get the central point of the transformer
      //       const {
      //   nodeCenterX : nextTransformerX,
      //   nodeCenterY: nextTransformerY,
      // } = getElTransformOriginRelativeViewport(elementsWithTransform[i + 1].element);

      // const originsReverted = []
      let { nodeCenterX: transformerCenterX, nodeCenterY: transformerCenterY } =
        getElTransformOriginRelativeViewport(elementsWithTransform[i].element);
      console.log(
        'CENTER ORIGIN of Transformer BEFORE reverted to previous origin',
        'transformerCenterX',
        transformerCenterX,
        'transformerCenterY',
        transformerCenterY
      );

      for (let j = 0; j < originsReverted.length; j++) {
        const distanceTransformerOriginX =
          transformerCenterX - originsReverted[j].transformerCenterX;
        const distanceTransformerOriginY =
          transformerCenterY - originsReverted[j].transformerCenterY;

        const {
          revertedX: nextRevertedTransformerX,
          revertedY: nextRevertedTransformerY
        } = revertCoord(
          elementsWithTransform[j].matrix,
          distanceTransformerOriginX,
          distanceTransformerOriginY
        );

        transformerCenterX =
          originsReverted[j].transformerCenterX + nextRevertedTransformerX;
        transformerCenterY =
          originsReverted[j].transformerCenterY + nextRevertedTransformerY;

        // console.log(transformerCenterX, transformerCenterY)
      }

      console.log(
        'CENTER ORIGIN of Transformer AFTER reverted to previous origin',
        'transformerCenterX',
        transformerCenterX,
        'transformerCenterY',
        transformerCenterY
      );
      originsReverted.push({ transformerCenterX, transformerCenterY });
      console.log(originsReverted);

      console.log(
        'transformerCenterX',
        transformerCenterX,
        'transformerCenterY',
        transformerCenterY
      );

      // STEP 3: Get the distance between the central point of node and central point of transformer

      const nodeXToTransformerX = nodeCenterX - transformerCenterX;
      const nodeYToTransformerY = nodeCenterY - transformerCenterY;

      // // Get LEFT and TOP respect to transform-origin of transformer

      // // If the element is inverted that means the bottom is the reflection of top of non-inverted element and viceversa. The same goes X axis.
      // const leftToAncestorOrigin =
      //   elTransformer.matrix[0] < 0
      //     ? transformerCenterX - convertedRight
      //     : transformerCenterX - convertedLeft;
      // const topToAncestorOrigin =
      //   elTransformer.matrix[3] < 0
      //     ? transformerCenterY - convertedBottom
      //     : transformerCenterY - convertedTop;

      // // Get RIGHT and BOTTOM respect to transform-origin of transformer

      // const rightToAncestorOrigin =
      //   elTransformer.matrix[0] < 0
      //     ? transformerCenterX - convertedLeft
      //     : transformerCenterX - convertedRight;
      // const bottomToAncestorOrigin =
      //   elTransformer.matrix[3] < 0
      //     ? transformerCenterY - convertedTop
      //     : transformerCenterY - convertedBottom;

      // console.log(
      //   'topToAncestorOrigin',
      //   topToAncestorOrigin,
      //   'bottomToAncestorOrigin',
      //   bottomToAncestorOrigin
      // );

      // STEP 4: Revert the obtained distance in previous step ? perhaps revert the transform origin of next transformer

      const { revertedX: revertedXDistance, revertedY: revertedYDistance } =
        revertCoord(
          elTransformer.matrix,
          nodeXToTransformerX,
          nodeYToTransformerY
        );

      // // Revert LEFT and TOP

      // const {
      //   revertedX: revertedLeftToAncestorOrigin,
      //   revertedY: revertedTopToAncestorOrigin
      // } = revertCoord(
      //   elTransformer.matrix,
      //   leftToAncestorOrigin,
      //   topToAncestorOrigin
      // );

      // console.log('revertedTopToAncestorOrigin', revertedTopToAncestorOrigin);

      // STEP 5: Add transformer central point to reverted distances so we can get the reverted distance relative to the viewport

      nodeCenterX = transformerCenterX + revertedXDistance;
      nodeCenterY = transformerCenterY + revertedYDistance;

      // Revert the transformer origin of next transformer
      // STEP 6: Repeat process until every transformer have been reverted

      // convertedLeft =
      //   transformerCenterX - revertedLeftToAncestorOrigin;
      // convertedTop =
      //   transformerCenterY - revertedTopToAncestorOrigin;

      // // Revert RIGHT and BOTTOM

      // const {
      //   revertedX: revertedRightToAncestorOrigin,
      //   revertedY: revertedBottomToAncestorOrigin
      // } = revertCoord(
      //   elTransformer.matrix,
      //   rightToAncestorOrigin,
      //   bottomToAncestorOrigin
      // );

      // console.log(
      //   'revertedBottomToAncestorOrigin',
      //   revertedBottomToAncestorOrigin
      // );

      // convertedRight =
      //   transformerCenterX - revertedRightToAncestorOrigin;
      // convertedBottom =
      //   transformerCenterY - revertedBottomToAncestorOrigin;

      // const revertedHeightElTransformer = Math.abs(revertedBottom_RelativeViewport - revertedTop_RelativeViewport);
      // const revertedWidthElTransformer = Math.abs(revertedRight_RelativeViewport - revertedLeft_RelativeViewport);

      // right = revertedXElCentralPoint_RelativeViewport - revertedWidthElTransformer/2;
      // top = revertedYElCentralPoint_RelativeViewport - revertedHeightElTransformer/2;

      // xElCentralPoint = (xOriginToViewport - (  xToOrigin*t[3] - yToOrigin*t[2] + t[2]*t[5] - t[4]*t[3] )/det) - ((right - x)/2) / Math.abs(t[0]);
      // yElCentralPoint = (yOriginToViewport - ( -xToOrigin*t[1] + yToOrigin*t[0] + t[4]*t[1] - t[0]*t[5] )/det) - ((bottom - y)/2) / Math.abs(t[3]);

      console.log(
        'Iteration',
        i,
        'with',
        elementsWithTransform[i].element,
        'matrix',
        elementsWithTransform[i].matrix,
        'nodeCenterX',
        nodeCenterX,
        'nodeCenterY',
        nodeCenterY
        // 'origin Y',
        // elementsWithTransform[i].y,
        // 'get convertedTop',
        // convertedTop,
        // 'convertedBottom',
        // convertedBottom
      );
    }
    // // console.log('Y origin to El', originCoord.y)
    // // console.log('El top', originCoord.element.getBoundingClientRect().top);
    // const yOriginToViewport = originCoord.element.getBoundingClientRect().top + originCoord.y
    // // console.log('Y Origin To Viewport', yOriginToViewport)
    // const xOriginToViewport = originCoord.element.getBoundingClientRect().left + originCoord.x
    // console.log('ancestor X', originCoord.element.getBoundingClientRect().left, 'ancestor origin X', originCoord.x);
    // const yToOrigin = yOriginToViewport - yElCentralPoint;
    // const xToOrigin = xOriginToViewport - xElCentralPoint;
    // // console.log("Node's X to Origin", xToOrigin, "Node' Y to Origin", yToOrigin);

    //   2D matrix
    //   need some math to apply inverse of matrix
    //   var t = matrix,
    //       det = t[0]*t[3] - t[1]*t[2];
    // console.log('Node X to origin After Inverse' , (  xToOrigin*t[3] - yToOrigin*t[2] + t[2]*t[5] - t[4]*t[3] )/det)
    // console.log('Node Y to origin After Inverse' , ( -xToOrigin*t[1] + yToOrigin*t[0] + t[4]*t[1] - t[0]*t[5] )/det)
    //   return {
    //       x: (originCoord.x - (  xToOrigin*t[3] - yToOrigin*t[2] + t[2]*t[5] - t[4]*t[3] )/det) - (right - x)/2,
    //       y: (originCoord.y - ( -xToOrigin*t[1] + yToOrigin*t[0] + t[4]*t[1] - t[0]*t[5] )/det) - (bottom - y)/2
    //   }
    // console.log('xElCentralPoint', xElCentralPoint, 'elementsWithTransform[elementsWithTransform.length-1].x', elementsWithTransform[elementsWithTransform.length-1].x)
    // console.log('yElCentralPoint', yElCentralPoint, 'elementsWithTransform[elementsWithTransform.length-1].y', elementsWithTransform[elementsWithTransform.length-1].y)

    // STEP 7: Get top, left, right and bottom with offsetWidth/offsetHeight and final result of node coordinates
    // console.log('offsetHeight', node.offsetHeight, 'nodeCenterX', nodeCenterX, 'nodeCenterY', nodeCenterY, 'of node', node);

    return {
      //   x: xElCentralPoint - elementsWithTransform[elementsWithTransform.length-1].x,
      //   x: xElCentralPoint,
      //   x,
      //   y: yElCentralPoint - elementsWithTransform[elementsWithTransform.length-1].y,
      //   y
      // y: yElCentralPoint
      // top: Math.ceil(nodeCenterY - node.offsetHeight/2),

      top: nodeCenterY - node.offsetHeight / 2,
      left: nodeCenterX - node.offsetWidth / 2,
      bottom: nodeCenterY + node.offsetHeight / 2,
      right: nodeCenterX + node.offsetWidth / 2
      // top: Math.round(nodeCenterY) - node.offsetHeight/2,
      // left: Math.round(nodeCenterX) - node.offsetWidth/2,
      // bottom: Math.round(nodeCenterY) + node.offsetHeight/2,
      // right: Math.round(nodeCenterX) + node.offsetWidth/2,
      // top: convertedTop,
      // left: convertedLeft,
      // bottom: convertedBottom,
      // right: convertedRight
    };
  } /*if (transformArr.length > 6)*/ else {
    return node.getBoundingClientRect();
    //3D matrix
    //haven't done the calculation to apply inverse of 4x4 matrix
  }
}

const measureLayout = (node, relativeToNativeNode, callback) => {
  const relativeNode = relativeToNativeNode || (node && node.parentNode);
  if (node && relativeNode) {
    setTimeout(() => {
      // console.log('relativeNode before getCombinedMatrix', relativeNode);
      const transformInfo = getCombinedMatrix(node);
      console.log(transformInfo);

      //   if(!arraysEqual(transformInfo.combinedMatrix, [1,0,0,1,0,0])) {

      if (transformInfo.elementsWithTransform.length) {
        const { height, width } = getRect(node);
        const convertedNode = convertCoord(transformInfo, node);

        const transformInfoRelativeNode = getCombinedMatrix(relativeNode);

        const convertedRelativeNode = convertCoord(
          transformInfoRelativeNode,
          relativeNode
        );

        const x = convertedNode.left - convertedRelativeNode.left;
        console.log(
          'convertedNode.TOP',
          convertedNode.top,
          'convertedRelativeNode.TOP',
          convertedRelativeNode.top,
          'REST',
          convertedNode.top - convertedRelativeNode.top
        );
        // const y = Math.ceil(convertedNode.top) - Math.ceil(convertedRelativeNode.top);
        const y = convertedNode.top - convertedRelativeNode.top;
        // const y = Math.ceil(convertedNode.top - convertedRelativeNode.top);

        // console.log(topLeft_pos2);
        callback(x, y, width, height, convertedNode.left, convertedNode.top);
        return;
      }

      const relativeRect = getBoundingClientRect(relativeNode);
      const { height, left, top, width } = getRect(node);
      const x = left - relativeRect.left;
      //   console.log('left', left, 'relativeRect.left', relativeRect.left);
      const y = top - relativeRect.top;
      callback(x, y, width, height, left, top);
    }, 0);
  }
};

const focusableElements = {
  A: true,
  INPUT: true,
  SELECT: true,
  TEXTAREA: true
};

const UIManager = {
  blur(node) {
    try {
      node.blur();
    } catch (err) {}
  },

  focus(node) {
    try {
      const name = node.nodeName;
      // A tabIndex of -1 allows element to be programmatically focused but
      // prevents keyboard focus, so we don't want to set the value on elements
      // that support keyboard focus by default.
      if (
        node.getAttribute('tabIndex') == null &&
        focusableElements[name] == null
      ) {
        node.setAttribute('tabIndex', '-1');
      }
      node.focus();
    } catch (err) {}
  },

  measure(node, callback) {
    measureLayout(node, null, callback);
  },

  measureInWindow(node, callback) {
    if (node) {
      setTimeout(() => {
        const { height, left, top, width } = getRect(node);
        callback(left, top, width, height);
      }, 0);
    }
  },

  measureLayout(node, relativeToNativeNode, onFail, onSuccess) {
    measureLayout(node, relativeToNativeNode, onSuccess);
  },

  updateView(node, props) {
    for (const prop in props) {
      if (!Object.prototype.hasOwnProperty.call(props, prop)) {
        continue;
      }

      const value = props[prop];
      switch (prop) {
        case 'style': {
          setValueForStyles(node, value);
          break;
        }
        case 'class':
        case 'className': {
          node.setAttribute('class', value);
          break;
        }
        case 'text':
        case 'value':
          // native platforms use `text` prop to replace text input value
          node.value = value;
          break;
        default:
          node.setAttribute(prop, value);
      }
    }
  },

  configureNextLayoutAnimation(config, onAnimationDidEnd) {
    onAnimationDidEnd();
  },

  // mocks
  setLayoutAnimationEnabledExperimental() {}
};

export default UIManager;
